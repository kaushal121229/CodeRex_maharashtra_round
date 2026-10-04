import React, { useState, useEffect } from 'react';
import { Smartphone, Mic, ArrowLeft, ArrowRight, Link as LinkIcon, Check, Copy } from 'lucide-react';
import { getOrCreateDeviceId } from '../utils/deviceUtils';
import { calculateRMS } from '../utils/audioUtils';
import { getApiBaseUrl, getPublicAppUrl, setCustomApiUrl } from '../utils/config';

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
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[1]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [backendInput, setBackendInput] = useState(getApiBaseUrl() || '');

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

  const handleCopyLink = () => {
    if (!sessionCode.trim()) return;
    const appBase = getPublicAppUrl();
    const url = `${appBase}/join/${encodeURIComponent(sessionCode.trim().toUpperCase())}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim() || !displayName.trim()) return;

    setIsLoading(true);
    setError(null);

    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setIsTestingMic(false);
    }

    const cleanCode = sessionCode.trim().toUpperCase();
    const apiBase = getApiBaseUrl();
    console.log('[JOIN] Joining room', cleanCode);

    if (!apiBase) {
      setError('Unable to reach cloud backend. Please check your internet connection.');
      setIsLoading(false);
      return;
    }

    // Check if participant had a previous ID stored for this room
    const savedPid = localStorage.getItem(`roundtable_pid_${cleanCode}`);

    try {
      const resp = await fetch(`${apiBase}/rooms/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({
          room_id: cleanCode,
          display_name: displayName.trim(),
          device_id: deviceId,
          avatar_color: selectedColor,
          participant_id: savedPid || undefined,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        let errorMsg = 'Meeting room not found or has ended. Please check the Room ID.';
        try {
          const parsed = JSON.parse(text);
          if (parsed.detail) errorMsg = parsed.detail;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await resp.json();
      const confirmedPid = data.participant.participant_id || data.participant.id;
      // Save for seamless reconnection
      localStorage.setItem(`roundtable_pid_${cleanCode}`, confirmedPid);
      console.log('[JOIN] Joined room', data.room_id || data.session_code, 'as', confirmedPid);

      onSessionJoined(data.room_id || data.session_code, data.participant);
    } catch (err: any) {
      console.error('[JOIN] Failed to join room:', err);
      setError(err.message || 'Failed to join meeting room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md p-6 sm:p-9 rounded-3xl glass-card-glow shadow-2xl animate-fade-in relative overflow-hidden">
        {/* Ambient Top Rim Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        {/* Back Link */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 mb-6 transition-colors cursor-pointer group font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 mb-3 border border-cyan-200/80 shadow-md shadow-cyan-500/10">
            <Smartphone className="w-7 h-7 text-cyan-600 animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Join Cloud Meeting</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto leading-relaxed">
            Connect your device as an active microphone node on any mobile network or Wi-Fi.
          </p>
        </div>

        {error && (
          <div className="p-4 mb-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Room ID
              </label>
              {sessionCode && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center space-x-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Join Link'}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="e.g. RT-48291"
              className="w-full px-4 py-3 rounded-xl glass-input font-mono tracking-wider text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Rahul, Saish, or Aman"
              className="w-full px-4 py-3 rounded-xl glass-input text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Avatar Color Tag
            </label>
            <div className="flex items-center justify-between px-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 cursor-pointer ${
                    selectedColor === c
                      ? 'scale-125 ring-2 ring-indigo-500 shadow-md ring-offset-2 ring-offset-white'
                      : 'opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: c,
                    boxShadow: selectedColor === c ? `0 0 10px ${c}80` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Microphone Pre-Check */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-800 font-semibold flex items-center space-x-2">
                <Mic className="w-4 h-4 text-cyan-600" />
                <span>Microphone Pre-Check</span>
              </span>
              <button
                type="button"
                onClick={toggleMicTest}
                className="text-[11px] font-bold text-cyan-600 hover:text-cyan-800 transition-colors cursor-pointer"
              >
                {isTestingMic ? 'Stop Test' : 'Test Mic Input'}
              </button>
            </div>

            {isTestingMic && (
              <div className="space-y-1.5 animate-fade-in">
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden p-0.5 border border-slate-300 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-600 rounded-full transition-all duration-75 shadow-sm shadow-cyan-500/40"
                    style={{ width: `${testMicLevel}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">
                  Speak into your device — input level is live
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl glass-btn-primary text-white font-semibold text-sm shadow-xl shadow-cyan-600/20 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <span>Connecting to Room...</span>
            ) : (
              <>
                <span>Join Meeting Mesh</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
