import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Copy, Check, QrCode, Smartphone, Layers, AlertCircle, Hash, Link as LinkIcon, Power, Users } from 'lucide-react';
import { Participant, TranscriptSegment, LiveMetrics } from '../types';
import { useRoundtableSocket } from '../hooks/useRoundtableSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { CaptionCard } from '../components/CaptionCard';
import { DeviceNodeBadge } from '../components/DeviceNodeBadge';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { OverlapBanner } from '../components/OverlapBanner';
import { MetricsBar } from '../components/MetricsBar';
import { QRCodeModal } from '../components/QRCodeModal';
import { getApiBaseUrl, getPublicAppUrl } from '../utils/config';

interface DashboardPageProps {
  sessionCode: string;
  sessionTitle: string;
  participant: Participant;
  onNavigateTab: (tab: 'transcript' | 'evaluation') => void;
  onParticipantToast?: (message: string, type: 'join' | 'leave' | 'reconnect') => void;
  onMeetingEnded?: (message: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  sessionCode,
  sessionTitle,
  participant,
  onNavigateTab,
  onParticipantToast,
  onMeetingEnded,
}) => {
  const [captions, setCaptions] = useState<TranscriptSegment[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [activeOverlap, setActiveOverlap] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const captionsEndRef = useRef<HTMLDivElement>(null);
  const overlapTimeoutRef = useRef<number | null>(null);

  const apiBase = getApiBaseUrl();
  const appBase = getPublicAppUrl();
  const joinUrl = `${appBase}/join/${encodeURIComponent(sessionCode)}`;
  const isHost = participant.role === 'host';

  // Initial fetch of any past transcript segments
  useEffect(() => {
    fetch(`${apiBase}/rooms/${encodeURIComponent(sessionCode)}/transcript`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCaptions(data);
        }
      })
      .catch((err) => console.error('Failed to load past transcript:', err));

    const metricsInterval = setInterval(() => {
      fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionCode)}/metrics`)
        .then((res) => res.json())
        .then((data) => setMetrics(data))
        .catch(() => {});
    }, 2500);

    return () => clearInterval(metricsInterval);
  }, [sessionCode, apiBase]);

  const handleNewCaption = (seg: TranscriptSegment) => {
    setCaptions((prev) => {
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
    endMeeting: wsEndMeeting,
    removeParticipant: wsRemoveParticipant,
  } = useRoundtableSocket({
    sessionCode,
    participantId: participant.participant_id,
    deviceId: participant.device_id,
    displayName: participant.display_name,
    avatarColor: participant.avatar_color || '#14B8A6',
    onNewCaption: handleNewCaption,
    onOverlapAlert: (speakers) => triggerOverlapAlert(speakers),
    onParticipantEvent: (msg, type) => {
      if (onParticipantToast) onParticipantToast(msg, type);
    },
    onMeetingEnded: (msg) => {
      if (onMeetingEnded) onMeetingEnded(msg);
    },
  });

  // Audio Capture Hook
  const {
    hasPermission,
    rmsLevel,
    errorMessage,
    startCapture,
  } = useAudioCapture({
    isMuted,
    onAudioChunk: (base64, rms, timestamp) => {
      sendAudioChunk(base64, rms, timestamp);
    },
    onLocalSpeech: (text, tStart, tEnd, conf) => {
      sendSyncSpeech(text, tStart, tEnd, conf);
    },
  });

  useEffect(() => {
    startCapture();
  }, [startCapture]);

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

  const handleCopyId = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEndMeeting = async () => {
    if (window.confirm('Are you sure you want to end this meeting for all participants?')) {
      wsEndMeeting();
      try {
        await fetch(`${apiBase}/rooms/${encodeURIComponent(sessionCode)}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: sessionCode, host_id: participant.participant_id }),
        });
      } catch (e) {
        console.error('Error ending room on server:', e);
      }
    }
  };

  const handleRemoveParticipant = (targetPid: string) => {
    if (window.confirm('Remove this participant from the meeting?')) {
      wsRemoveParticipant(targetPid);
      fetch(`${apiBase}/rooms/${encodeURIComponent(sessionCode)}/participants/${encodeURIComponent(targetPid)}/remove`, {
        method: 'POST',
      }).catch(() => {});
    }
  };

  const handleSimulateOverlap = async () => {
    try {
      await fetch(`${apiBase}/api/evaluation/simulate-overlap/${sessionCode}`, { method: 'POST' });
    } catch (e) {
      console.error('Error triggering simulate overlap:', e);
    }
  };

  const connectedCount = participants.filter((p) => p.status === 'connected' || p.connection_status === 'connected').length || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= SECTION 7 & 8: LIVE ROOM UI & HOST CONTROLS ================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">
                ROUNDTABLE
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold tracking-wider">
                🔴 LIVE
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-sm font-semibold text-slate-300">Room ID:</span>
              <span className="text-base font-mono font-extrabold text-white tracking-wider">
                {sessionCode}
              </span>
            </div>
          </div>
        </div>

        {/* Meeting Controls: Copy Room ID, Copy Join Link, Show QR, Mic Visualizer, Mute & End Meeting */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Copy Room ID Button */}
          <button
            onClick={handleCopyId}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Hash className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{copiedId ? 'ID Copied' : 'Copy Room ID'}</span>
          </button>

          {/* Copy Join Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />}
            <span>{copiedLink ? 'Link Copied' : 'Copy Join Link'}</span>
          </button>

          {/* Show QR Button */}
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR</span>
          </button>

          {/* Audio Visualizer */}
          <AudioVisualizer rmsLevel={rmsLevel} isMuted={isMuted} barCount={12} />

          {/* Mute/Unmute Mic Toggle */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
          >
            {isMuted ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>Unmute Mic</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Mute Mic</span>
              </>
            )}
          </button>

          {/* Host End Meeting Button */}
          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition-all cursor-pointer"
              title="End meeting for all participants"
            >
              <Power className="w-3.5 h-3.5" />
              <span>End Meeting</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SECTION 7: STATUS & CONNECTION BADGE ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-slate-900/60 border border-white/5 text-xs">
        <div className="flex items-center space-x-4">
          {/* Connection Status indicator */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Connection:</span>
            {connectionStatus === 'connected' ? (
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>🟢 Connected</span>
              </span>
            ) : connectionStatus === 'reconnecting' ? (
              <span className="text-amber-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>🟡 Reconnecting...</span>
              </span>
            ) : (
              <span className="text-red-400 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>🔴 Connection Lost</span>
              </span>
            )}
          </div>

          {/* Connected Devices */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Connected Devices:</span>
            <span className="text-white font-mono font-bold bg-slate-800 px-2 py-0.5 rounded-full">
              {connectedCount}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400 font-mono">
          <span>Latency: <strong className="text-yellow-300">{pingLatency || 80}ms</strong></span>
        </div>
      </div>

      {/* Live System Metrics Bar */}
      <MetricsBar
        metrics={metrics}
        pingLatency={pingLatency}
        onSimulateOverlap={handleSimulateOverlap}
      />

      {/* Mic Permission Warning */}
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

      {/* Main Grid: Live Captions Stream (Left) + Participants & Mic Nodes (Right) */}
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
                  Start speaking naturally. Devices on any mobile network or Wi-Fi will synchronize audio streams and attribute your speech.
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

        {/* Right: Connected Participants & Microphone Nodes (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Participants Panel */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  Participants ({participants.length || 1})
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium">
                {connectedCount} Online
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {participants.length === 0 ? (
                <DeviceNodeBadge participant={participant} isSelf={true} isHost={isHost} />
              ) : (
                participants.map((p) => (
                  <DeviceNodeBadge
                    key={p.participant_id || (p as any).id}
                    participant={p}
                    isSelf={p.participant_id === participant.participant_id || (p as any).id === participant.participant_id}
                    isHost={isHost}
                    onRemove={handleRemoveParticipant}
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
                <span>Show Join QR / Invite Device</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border border-indigo-500/20 shadow-xl space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Cloud Meeting Mesh
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              All devices connect to the central cloud room via WebSockets. Whether on home Wi-Fi, office networks, or cellular 4G/5G data, speech streams are coordinated in real-time.
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
                Evaluation Metrics
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
