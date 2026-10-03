import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Copy, Check, QrCode, Smartphone, Layers, AlertCircle, ArrowDown } from 'lucide-react';
import { Participant, TranscriptSegment, LiveMetrics } from '../types';
import { useRoundtableSocket } from '../hooks/useRoundtableSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { CaptionCard } from '../components/CaptionCard';
import { DeviceNodeBadge } from '../components/DeviceNodeBadge';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { OverlapBanner } from '../components/OverlapBanner';
import { MetricsBar } from '../components/MetricsBar';
import { QRCodeModal } from '../components/QRCodeModal';

interface DashboardPageProps {
  sessionCode: string;
  sessionTitle: string;
  participant: Participant;
  onNavigateTab: (tab: 'transcript' | 'evaluation') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  sessionCode,
  sessionTitle,
  participant,
  onNavigateTab,
}) => {
  const [captions, setCaptions] = useState<TranscriptSegment[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [activeOverlap, setActiveOverlap] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const captionsEndRef = useRef<HTMLDivElement>(null);
  const overlapTimeoutRef = useRef<number | null>(null);

  // Initial fetch of any past transcript segments (e.g. on rejoin/reconnect)
  useEffect(() => {
    fetch(`/api/sessions/${sessionCode}/transcript`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCaptions(data);
        }
      })
      .catch((err) => console.error('Failed to load past transcript:', err));

    // Poll live metrics periodically
    const metricsInterval = setInterval(() => {
      fetch(`/api/sessions/${sessionCode}/metrics`)
        .then((res) => res.json())
        .then((data) => setMetrics(data))
        .catch(() => {});
    }, 2000);

    return () => clearInterval(metricsInterval);
  }, [sessionCode]);

  // Handle incoming live captions from WebSocket
  const handleNewCaption = (seg: TranscriptSegment) => {
    setCaptions((prev) => {
      // Avoid exact duplicates
      if (prev.some((p) => p.text === seg.text && Math.abs(p.start_timestamp - seg.start_timestamp) < 0.5)) {
        return prev;
      }
      return [...prev, seg];
    });

    if (seg.is_overlap) {
      triggerOverlapAlert(seg.overlap_with || 'Multiple speakers');
    }
  };

  const triggerOverlapAlert = (speakers: string) => {
    setActiveOverlap(speakers);
    if (overlapTimeoutRef.current) clearTimeout(overlapTimeoutRef.current);
    overlapTimeoutRef.current = window.setTimeout(() => {
      setActiveOverlap(null);
    }, 6000);
  };

  // WebSocket Connection Hook
  const {
    connectionStatus,
    participants,
    pingLatency,
    sendAudioChunk,
    sendSyncSpeech,
    toggleMute: wsToggleMute,
  } = useRoundtableSocket({
    sessionCode,
    participantId: participant.participant_id,
    deviceId: participant.device_id,
    displayName: participant.display_name,
    avatarColor: participant.avatar_color,
    onNewCaption: handleNewCaption,
    onOverlapAlert: (speakers) => triggerOverlapAlert(speakers),
  });

  // Audio Capture Hook
  const {
    hasPermission,
    isRecording,
    rmsLevel,
    errorMessage,
    startCapture,
  } = useAudioCapture({
    isMuted,
    onAudioChunk: (base64, rms, timestamp) => {
      sendAudioChunk(base64, rms, timestamp);
    },
    onLocalSpeech: (text, tStart, tEnd, conf) => {
      // Hybrid assistive speech recognition stream
      sendSyncSpeech(text, tStart, tEnd, conf);
    },
  });

  // Start audio on mount
  useEffect(() => {
    startCapture();
  }, [startCapture]);

  // Autoscroll to bottom when new captions arrive
  useEffect(() => {
    if (autoScroll && captionsEndRef.current) {
      captionsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [captions, autoScroll]);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    wsToggleMute(nextMuted);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSimulateOverlap = async () => {
    try {
      await fetch(`/api/evaluation/simulate-overlap/${sessionCode}`, { method: 'POST' });
    } catch (e) {
      console.error('Error triggering simulate overlap:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Session Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{sessionTitle}</h2>
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono transition-colors"
                title="Copy Session Code"
              >
                <span>{sessionCode}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <span className="text-xs text-slate-400">
              Multi-Device Collaborative Audio Capture Node
            </span>
          </div>
        </div>

        {/* Device Controls: Visualizer, Mute Toggle, QR Invite */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Live Mic Level Equalizer */}
          <AudioVisualizer rmsLevel={rmsLevel} isMuted={isMuted} barCount={14} />

          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
          >
            {isMuted ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Unmute Mic</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Mute Mic</span>
              </>
            )}
          </button>

          {/* Invite Device QR */}
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Invite Devices</span>
          </button>
        </div>
      </div>

      {/* Live System Metrics Bar */}
      <MetricsBar
        metrics={metrics}
        pingLatency={pingLatency}
        onSimulateOverlap={handleSimulateOverlap}
      />

      {/* Permission Warning if applicable */}
      {hasPermission === false && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>Microphone Permission Needed:</strong> {errorMessage || 'Please allow microphone access to participate as an audio node.'}
          </div>
        </div>
      )}

      {/* Overlapping Speech Alert Banner */}
      {activeOverlap && (
        <OverlapBanner
          speakers={activeOverlap}
          onDismiss={() => setActiveOverlap(null)}
        />
      )}

      {/* Main Grid: Live Captions Stream (Left) + Devices & Info (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Live Speaker-Attributed Captions (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-[650px] rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Live Speaker-Attributed Captions
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400 font-mono">
                {captions.length} Segments
              </span>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  autoScroll
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'text-slate-400 border-white/10'
                }`}
              >
                Auto-scroll {autoScroll ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Captions Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
            {captions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                  <Mic className="w-7 h-7 animate-pulse" />
                </div>
                <h4 className="text-base font-semibold text-slate-200">
                  Listening across connected microphone nodes...
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Start speaking naturally. Your device and nearby connected devices will coordinate audio streams and attribute your speech.
                </p>
              </div>
            ) : (
              captions.map((seg, idx) => (
                <CaptionCard
                  key={seg.id || idx}
                  segment={seg}
                  isLatest={idx === captions.length - 1}
                />
              ))
            )}
            <div ref={captionsEndRef} />
          </div>
        </div>

        {/* Right: Connected Microphone Nodes & Mesh Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Connected Device Nodes Panel */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  Microphone Nodes
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium">
                {participants.length || 1} Online
              </span>
            </div>

            <div className="space-y-2.5">
              {participants.length === 0 ? (
                /* Fallback self node */
                <DeviceNodeBadge participant={participant} isSelf={true} />
              ) : (
                participants.map((p) => (
                  <DeviceNodeBadge
                    key={p.participant_id}
                    participant={p}
                    isSelf={p.participant_id === participant.participant_id}
                  />
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Another Phone / Laptop Mic</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-500/20 shadow-xl space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Roundtable Capabilities
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every connected device continuously streams independent audio. The backend coordinator aligns timestamps and performs cross-device energy comparison to attribute speakers and separate simultaneous overlapping speech.
            </p>

            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={() => onNavigateTab('transcript')}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium text-center transition-colors"
              >
                Full Transcript
              </button>
              <button
                onClick={() => onNavigateTab('evaluation')}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium text-center transition-colors"
              >
                Evaluation Benchmarks
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Invitation Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        sessionCode={sessionCode}
        sessionTitle={sessionTitle}
      />
    </div>
  );
};
