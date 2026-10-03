import React, { useState, useEffect } from 'react';
import { Smartphone, Mic, MicOff, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { getOrCreateDeviceId } from '../utils/deviceUtils';
import { calculateRMS } from '../utils/audioUtils';

interface JoinSessionPageProps {
  initialCode?: string;
  onSessionJoined: (sessionCode: string, participant: any) => void;
  onBack: () => void;
}

const AVATAR_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Rose
  '#14B8A6', // Teal
];

export const JoinSessionPage: React.FC<JoinSessionPageProps> = ({
  initialCode = '',
  onSessionJoined,
  onBack,
}) => {
  const [sessionCode, setSessionCode] = useState(initialCode.toUpperCase());
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mic test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testMicLevel, setTestMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const deviceId = getOrCreateDeviceId();

  useEffect(() => {
    if (initialCode) {
      setSessionCode(initialCode.toUpperCase());
    }
  }, [initialCode]);

  // Clean up mic test on unmount
  useEffect(() => {
    return () => {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [micStream]);

  const toggleMicTest = async () => {
    if (isTestingMic) {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        setMicStream(null);
      }
      setIsTestingMic(false);
      setTestMicLevel(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      setIsTestingMic(true);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        const samples = e.inputBuffer.getChannelData(0);
        const rms = calculateRMS(samples);
        setTestMicLevel(Math.min(100, Math.round(rms * 400)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err: any) {
      alert('Microphone permission required: ' + err.message);
      setIsTestingMic(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim() || !displayName.trim()) return;

    setIsLoading(true);
    setError(null);

    // Stop test mic before joining
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setIsTestingMic(false);
    }

    const cleanCode = sessionCode.trim().toUpperCase();

    try {
      const resp = await fetch(`/api/sessions/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_code: cleanCode,
          display_name: displayName.trim(),
          device_id: deviceId,
          avatar_color: selectedColor,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Could not join session. Verify the code.');
      }

      const data = await resp.json();
      onSessionJoined(data.session_code, data.participant);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to join session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl">
        {/* Back Link */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Join Roundtable</h2>
          <p className="text-sm text-slate-400 mt-1">
            Connect your device as a collaborative microphone node.
          </p>
        </div>

        {error && (
          <div className="p-3 mb-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Roundtable Code
            </label>
            <input
              type="text"
              required
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="e.g. RT-48291"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white font-mono tracking-wider placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Saish or Rahul"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Avatar Color Tag
            </label>
            <div className="flex items-center space-x-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                    selectedColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Microphone Pre-Check */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium flex items-center space-x-1.5">
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
                <span>Microphone Check</span>
              </span>
              <button
                type="button"
                onClick={toggleMicTest}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                {isTestingMic ? 'Stop Test' : 'Test Mic Level'}
              </button>
            </div>

            {isTestingMic && (
              <div className="space-y-1">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-75"
                    style={{ width: `${testMicLevel}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">Speak into your device to test audio input level</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <span>Connecting Device Node...</span>
            ) : (
              <>
                <span>Join Roundtable</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
