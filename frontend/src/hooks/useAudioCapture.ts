import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateRMS, downsampleTo16k, float32ToInt16, arrayBufferToBase64 } from '../utils/audioUtils';

interface UseAudioCaptureProps {
  isMuted?: boolean;
  onAudioChunk?: (base64Data: string, rmsEnergy: number, timestamp: number) => void;
  onLocalSpeech?: (text: string, startTimestamp: number, endTimestamp: number, confidence: number) => void;
}

export function useAudioCapture({
  isMuted = false,
  onAudioChunk,
  onLocalSpeech,
}: UseAudioCaptureProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [rmsLevel, setRmsLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  
  // Rolling audio chunk buffer (accumulate ~500ms before sending)
  const bufferAccumulatorRef = useRef<Float32Array[]>([]);
  const accumulatedSamplesRef = useRef<number>(0);
  const chunkStartTimeRef = useRef<number>(Date.now() / 1000);

  const startCapture = useCallback(async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      mediaStreamRef.current = stream;
      setHasPermission(true);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      // 4096 buffer size gives ~90ms chunks at 44.1kHz / 48kHz
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted) {
          setRmsLevel(0);
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);
        // Compute RMS for live meter
        const rms = calculateRMS(inputChannel);
        setRmsLevel(rms);

        // Copy audio data
        const copy = new Float32Array(inputChannel);
        bufferAccumulatorRef.current.push(copy);
        accumulatedSamplesRef.current += copy.length;

        // When ~0.5s of audio is accumulated (e.g. 24,000 samples at 48kHz)
        const targetSamples = Math.round(ctx.sampleRate * 0.5);
        if (accumulatedSamplesRef.current >= targetSamples) {
          const totalLength = bufferAccumulatorRef.current.reduce((acc, curr) => acc + curr.length, 0);
          const merged = new Float32Array(totalLength);
          let offset = 0;
          for (const buf of bufferAccumulatorRef.current) {
            merged.set(buf, offset);
            offset += buf.length;
          }

          // Clear accumulator
          bufferAccumulatorRef.current = [];
          accumulatedSamplesRef.current = 0;

          // Downsample to 16,000 Hz mono
          const downsampled = downsampleTo16k(merged, ctx.sampleRate, 16000);
          const int16Array = float32ToInt16(downsampled);
          const base64Data = arrayBufferToBase64(int16Array.buffer);

          const timestamp = chunkStartTimeRef.current;
          chunkStartTimeRef.current = Date.now() / 1000;

          if (onAudioChunk && base64Data) {
            onAudioChunk(base64Data, rms, timestamp);
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsRecording(true);

      // Initialize Web Speech API for low-latency client speech assistance
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';

          let speechStartTime = Date.now() / 1000;

          recognition.onstart = () => {
            speechStartTime = Date.now() / 1000;
          };

          recognition.onresult = (event: any) => {
            const results = event.results;
            const latest = results[results.length - 1];
            if (latest.isFinal) {
              const transcript = latest[0].transcript;
              const confidence = latest[0].confidence || 0.95;
              const speechEndTime = Date.now() / 1000;
              if (onLocalSpeech && transcript.trim()) {
                onLocalSpeech(transcript.trim(), speechStartTime, speechEndTime, confidence);
              }
              speechStartTime = speechEndTime;
            }
          };

          recognition.onerror = (e: any) => {
            // Ignore non-fatal speech errors like 'no-speech'
            if (e.error !== 'no-speech') {
              console.warn('SpeechRecognition error:', e.error);
            }
          };

          recognition.onend = () => {
            // Restart if still recording
            if (mediaStreamRef.current && mediaStreamRef.current.active) {
              try {
                recognition.start();
              } catch (_) {}
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition could not be started:', e);
        }
      }

    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setHasPermission(false);
      setErrorMessage(err.message || 'Microphone access denied. Please grant permission in your browser.');
    }
  }, [isMuted, onAudioChunk, onLocalSpeech]);

  const stopCapture = useCallback(() => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRmsLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    hasPermission,
    isRecording,
    rmsLevel,
    errorMessage,
    startCapture,
    stopCapture,
  };
}
