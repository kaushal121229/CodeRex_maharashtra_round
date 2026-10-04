import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  const triggerOverlapAlert = useCallback((speakers: string) => {
    setActiveOverlap(speakers);
    if (overlapTimeoutRef.current) clearTimeout(overlapTimeoutRef.current);
    overlapTimeoutRef.current = window.setTimeout(() => {
      setActiveOverlap(null);
    }, 6000);
  }, []);

  const handleNewCaption = useCallback((seg: TranscriptSegment) => {
    setCaptions((prev) => {
      const isDuplicate = prev.some(
        (p) =>
          p.participant_id === seg.participant_id &&
          (p.text.toLowerCase().trim() === seg.text.toLowerCase().trim() ||
           seg.text.toLowerCase().includes(p.text.toLowerCase()) ||
           p.text.toLowerCase().includes(seg.text.toLowerCase())) &&
          Math.abs(p.start_timestamp - seg.start_timestamp) < 3.0
      );
      if (isDuplicate) {
        return prev;
      }
      return [...prev, seg];
    });

    if (seg.is_overlap) {
      triggerOverlapAlert(seg.overlap_with || 'Multiple speakers');
    }
  }, [triggerOverlapAlert]);

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
    onOverlapAlert: triggerOverlapAlert,
    onParticipantEvent: onParticipantToast,
    onMeetingEnded: onMeetingEnded,
  });

  const handleAudioChunk = useCallback((base64: string, rms: number, timestamp: number) => {
    sendAudioChunk(base64, rms, timestamp);
  }, [sendAudioChunk]);

  const handleLocalSpeech = useCallback((text: string, tStart: number, tEnd: number, conf: number) => {
    sendSyncSpeech(text, tStart, tEnd, conf);
  }, [sendSyncSpeech]);

  // Audio Capture Hook
  const {
    hasPermission,
    rmsLevel,
    errorMessage,
    startCapture,
  } = useAudioCapture({
    isMuted,
    onAudioChunk: handleAudioChunk,
    onLocalSpeech: handleLocalSpeech,
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl glass-card-glow shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-500 shadow-xs">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-live-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-600">
                ROUNDTABLE MESH
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold tracking-wider animate-pulse shadow-xs">
                🔴 LIVE STREAM
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs font-semibold text-slate-500">Room Code:</span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-slate-900 tracking-widest bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {sessionCode}
              </span>
            </div>
          </div>
        </div>

        {/* Meeting Controls: Copy Room ID, Copy Join Link, Show QR, Mic Visualizer, Mute & End Meeting */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2.5">
          {/* Copy Room ID Button */}
          <button
            onClick={handleCopyId}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold cursor-pointer"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Hash className="w-3.5 h-3.5 text-indigo-600" />}
            <span>{copiedId ? 'ID Copied' : 'Copy Room ID'}</span>
          </button>

          {/* Copy Join Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />}
            <span>{copiedLink ? 'Link Copied' : 'Copy Join Link'}</span>
          </button>

          {/* Show QR Button */}
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl glass-btn-primary text-white text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR</span>
          </button>

          {/* Audio Visualizer */}
          <AudioVisualizer rmsLevel={rmsLevel} isMuted={isMuted} barCount={12} />

          {/* Mute/Unmute Mic Toggle */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${
              isMuted
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-xs'
            }`}
          >
            {isMuted ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-red-500" />
                <span>Unmute Mic</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>Mute Mic</span>
              </>
            )}
          </button>

          {/* Host End Meeting Button */}
          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-red-500/25 transition-all hover:scale-105 cursor-pointer"
              title="End meeting for all participants"
            >
              <Power className="w-3.5 h-3.5" />
              <span>End Meeting</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SECTION 7: STATUS & CONNECTION BADGE ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl glass-card text-xs">
        <div className="flex items-center space-x-4">
          {/* Connection Status indicator */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium">Connection:</span>
            {connectionStatus === 'connected' ? (
              <span className="text-emerald-700 font-bold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 Mesh Connected</span>
              </span>
            ) : connectionStatus === 'reconnecting' ? (
              <span className="text-amber-700 font-bold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>🟡 Reconnecting...</span>
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>🔴 Connection Lost</span>
              </span>
            )}
          </div>

          {/* Connected Devices */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Active Devices:</span>
            <span className="text-slate-900 font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full shadow-2xs">
              {connectedCount}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-500 font-mono">
          <span>Transit Latency: <strong className="text-amber-600 font-mono font-bold">{pingLatency || 80}ms</strong></span>
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
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-3 glass-card">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Microphone Permission Needed:</strong> {errorMessage || 'Please allow microphone access to participate as an audio node.'}
            </div>
          </div>
          <button
            onClick={() => startCapture()}
            className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-semibold rounded-xl shrink-0 cursor-pointer transition-colors"
          >
            Allow Microphone
          </button>
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
        <div className="lg:col-span-8 flex flex-col h-[650px] rounded-3xl glass-card p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 mb-4">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Live Speaker-Attributed Captions
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {captions.length} Segments
              </span>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  autoScroll
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs font-semibold'
                    : 'text-slate-600 border-slate-200 hover:bg-slate-50'
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
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
                  <Mic className="w-8 h-8 animate-pulse text-indigo-600" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Listening across connected microphone nodes...
                </h4>
                <p className="text-xs text-slate-600 max-w-sm mt-1.5 leading-relaxed">
                  Start speaking naturally. Devices on any mobile network or Wi-Fi will synchronize audio streams and attribute your speech in real-time.
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
          <div className="p-5 sm:p-6 rounded-3xl glass-card shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Participants ({participants.length || 1})
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
                {connectedCount} Online
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
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

            <div className="mt-5 pt-4 border-t border-slate-200/80">
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Show Join QR / Invite Device</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="p-5 sm:p-6 rounded-3xl glass-card-glow shadow-xl space-y-3.5 bg-gradient-to-br from-white via-indigo-50/40 to-cyan-50/40 border border-indigo-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Cloud Meeting Mesh
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              All devices connect to the central cloud room via WebSockets. Whether on home Wi-Fi, office networks, or cellular 4G/5G data, speech streams are coordinated in real-time.
            </p>

            <div className="pt-2 flex items-center space-x-2.5">
              <button
                onClick={() => onNavigateTab('transcript')}
                className="flex-1 py-2.5 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold text-center cursor-pointer"
              >
                Full Transcript
              </button>
              <button
                onClick={() => onNavigateTab('evaluation')}
                className="flex-1 py-2.5 rounded-xl glass-btn-primary text-white text-xs font-semibold text-center cursor-pointer"
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
