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

  // Stable references for props so startCapture identity does not churn
  const isMutedRef = useRef(isMuted);
  const onAudioChunkRef = useRef(onAudioChunk);
  const onLocalSpeechRef = useRef(onLocalSpeech);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    onAudioChunkRef.current = onAudioChunk;
  }, [onAudioChunk]);

  useEffect(() => {
    onLocalSpeechRef.current = onLocalSpeech;
  }, [onLocalSpeech]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainNodeRef = useRef<GainNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const speechRestartTimeoutRef = useRef<number | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const lastRmsUpdateRef = useRef<number>(0);
  
  // Rolling audio chunk buffer (accumulate ~500ms before sending to backend)
  const bufferAccumulatorRef = useRef<Float32Array[]>([]);
  const accumulatedSamplesRef = useRef<number>(0);
  const chunkStartTimeRef = useRef<number>(Date.now() / 1000);

  // Global mobile touch / click listener to automatically resume suspended AudioContext
  useEffect(() => {
    const resumeIfSuspended = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener('click', resumeIfSuspended);
    window.addEventListener('touchstart', resumeIfSuspended, { passive: true });

    return () => {
      window.removeEventListener('click', resumeIfSuspended);
      window.removeEventListener('touchstart', resumeIfSuspended);
    };
  }, []);

  const startCapture = useCallback(async () => {
    if (isCapturingRef.current) {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume().catch(() => {});
      }
      return;
    }

    try {
      setErrorMessage(null);
      isCapturingRef.current = true;

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
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      // 4096 buffer size gives ~90ms chunks at 44.1kHz / 48kHz
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      // Use a GainNode set to 0 volume to prevent mic feedback echo into the speakers
      // while guaranteeing that the Web Audio rendering graph remains active across all browsers
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;
      muteGainNodeRef.current = muteGain;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) {
          const now = Date.now();
          if (now - lastRmsUpdateRef.current >= 150) {
            setRmsLevel(0);
            lastRmsUpdateRef.current = now;
          }
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);
        const rms = calculateRMS(inputChannel);

        // Throttle UI state updates to ~10fps to keep mobile performance buttery smooth
        const now = Date.now();
        if (now - lastRmsUpdateRef.current >= 100) {
          setRmsLevel(rms);
          lastRmsUpdateRef.current = now;
        }

        // Accumulate audio data for 500ms transmission chunk
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

          if (onAudioChunkRef.current && base64Data) {
            onAudioChunkRef.current(base64Data, rms, timestamp);
          }
        }
      };

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(ctx.destination);
      setIsRecording(true);

      // Initialize Web Speech API for low-latency client speech assistance (if available)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';

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
              if (onLocalSpeechRef.current && transcript.trim()) {
                onLocalSpeechRef.current(transcript.trim(), speechStartTime, speechEndTime, confidence);
              }
              speechStartTime = speechEndTime;
            }
          };

          recognition.onerror = (e: any) => {
            if (e.error !== 'no-speech') {
              console.warn('SpeechRecognition error:', e.error);
            }
          };

          recognition.onend = () => {
            if (isCapturingRef.current && mediaStreamRef.current && mediaStreamRef.current.active) {
              if (speechRestartTimeoutRef.current) clearTimeout(speechRestartTimeoutRef.current);
              speechRestartTimeoutRef.current = window.setTimeout(() => {
                if (isCapturingRef.current && mediaStreamRef.current && mediaStreamRef.current.active) {
                  try {
                    recognition.start();
                  } catch (_) {}
                }
              }, 600);
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition not started (Whisper will handle all STT):', e);
        }
      }

    } catch (err: any) {
      console.error('Microphone access failed:', err);
      isCapturingRef.current = false;
      setHasPermission(false);
      setErrorMessage(err.message || 'Microphone access denied. Please grant permission in your browser.');
    }
  }, []); // Stable empty dependency array

  const stopCapture = useCallback(() => {
    isCapturingRef.current = false;
    if (speechRestartTimeoutRef.current) {
      clearTimeout(speechRestartTimeoutRef.current);
      speechRestartTimeoutRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (muteGainNodeRef.current) {
      muteGainNodeRef.current.disconnect();
      muteGainNodeRef.current = null;
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
    bufferAccumulatorRef.current = [];
    accumulatedSamplesRef.current = 0;
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
