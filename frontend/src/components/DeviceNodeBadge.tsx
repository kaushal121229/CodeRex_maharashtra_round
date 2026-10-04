import React from 'react';
import { Mic, MicOff, Smartphone, Laptop, RefreshCw, UserX } from 'lucide-react';
import { Participant } from '../types';

interface DeviceNodeBadgeProps {
  participant: Participant;
  isSelf: boolean;
  isHost?: boolean;
  onRemove?: (participantId: string) => void;
}

export const DeviceNodeBadge: React.FC<DeviceNodeBadgeProps> = ({
  participant,
  isSelf,
  isHost,
  onRemove,
}) => {
  const isMobile = participant.device_id.startsWith('phone') || participant.device_id.includes('mobi');
  const isConnected = participant.status === 'connected' || participant.connection_status === 'connected';
  const isReconnecting = participant.status === 'reconnecting' || participant.connection_status === 'reconnecting';
  
  // Calculate speech activity level (0-100)
  const activityLevel = participant.rms_level ? Math.min(100, participant.rms_level * 500) : 0;
  const isSpeaking = activityLevel > 18;

  return (
    <div
      className={`p-3.5 rounded-2xl transition-all duration-300 ${
        isSpeaking
          ? 'glass-card-glow border-indigo-500/50 shadow-lg shadow-indigo-500/15'
          : 'glass-card-interactive hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar with speaking ring and neon glow */}
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md transition-all duration-300 ${
                isSpeaking
                  ? 'scale-110 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 animate-speaking-ripple'
                  : ''
              }`}
              style={{
                backgroundColor: participant.avatar_color || '#6366F1',
                boxShadow: isSpeaking
                  ? `0 0 16px ${participant.avatar_color || '#6366F1'}80`
                  : 'none',
              }}
            >
              {participant.display_name.charAt(0).toUpperCase()}
            </div>
            {/* Status indicator dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 shadow-sm ${
                isConnected
                  ? 'bg-emerald-400 shadow-emerald-400/50'
                  : isReconnecting
                  ? 'bg-amber-400 animate-pulse shadow-amber-400/50'
                  : 'bg-red-400 shadow-red-400/50'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-medium text-slate-200">
                {participant.display_name}
              </span>
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                  You
                </span>
              )}
              {participant.role === 'host' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                  Host
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
              {isMobile ? (
                <Smartphone className="w-3 h-3 text-slate-400" />
              ) : (
                <Laptop className="w-3 h-3 text-slate-400" />
              )}
              <span className="truncate max-w-[110px] font-mono text-[11px] text-slate-400">
                {participant.participant_id || participant.device_id}
              </span>
            </div>
          </div>
        </div>

        {/* Mic, Connection state, and Host Kick */}
        <div className="flex items-center space-x-2">
          {isReconnecting ? (
            <span className="flex items-center space-x-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Reconnecting...</span>
            </span>
          ) : isConnected ? (
            <div className="flex items-center space-x-1.5">
              {participant.mic_active ? (
                <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-950/40 border border-white/5">
                  <Mic className={`w-3.5 h-3.5 transition-colors ${isSpeaking ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                  {/* Mini audio activity meter bar */}
                  <div className="w-12 h-1.5 bg-slate-800/80 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 transition-all duration-75 shadow-sm shadow-cyan-400/50"
                      style={{ width: `${activityLevel}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="flex items-center space-x-1 text-[11px] text-slate-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
                  <MicOff className="w-3 h-3 text-red-400" />
                  <span>Muted</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-white/5">Offline</span>
          )}

          {/* Host remove participant button */}
          {isHost && !isSelf && onRemove && (
            <button
              onClick={() => onRemove(participant.participant_id || (participant as any).id)}
              title="Remove participant from meeting"
              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
            >
              <UserX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
