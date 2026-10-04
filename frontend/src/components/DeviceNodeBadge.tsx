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
          ? 'glass-card-glow border-indigo-400/80 shadow-lg shadow-indigo-500/10'
          : 'glass-card-interactive hover:border-indigo-300/80'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar with speaking ring and neon glow */}
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md transition-all duration-300 ${
                isSpeaking
                  ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 ring-offset-white animate-speaking-ripple'
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
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                isConnected
                  ? 'bg-emerald-500 shadow-emerald-500/50'
                  : isReconnecting
                  ? 'bg-amber-500 animate-pulse shadow-amber-500/50'
                  : 'bg-red-500 shadow-red-500/50'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm font-bold text-slate-900">
                {participant.display_name}
              </span>
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  You
                </span>
              )}
              {participant.role === 'host' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  Host
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-0.5">
              {isMobile ? (
                <Smartphone className="w-3 h-3 text-slate-500" />
              ) : (
                <Laptop className="w-3 h-3 text-slate-500" />
              )}
              <span className="truncate max-w-[110px] font-mono text-[11px] text-slate-500">
                {participant.participant_id || participant.device_id}
              </span>
            </div>
          </div>
        </div>

        {/* Mic, Connection state, and Host Kick */}
        <div className="flex items-center space-x-2">
          {isReconnecting ? (
            <span className="flex items-center space-x-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Reconnecting...</span>
            </span>
          ) : isConnected ? (
            <div className="flex items-center space-x-1.5">
              {participant.mic_active ? (
                <div className="flex items-center space-x-1.5 px-2 py-1 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-inner">
                  <Mic className={`w-3.5 h-3.5 transition-colors ${isSpeaking ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
                  {/* Mini audio activity meter bar */}
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 transition-all duration-75"
                      style={{ width: `${activityLevel}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="flex items-center space-x-1 text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg font-semibold">
                  <MicOff className="w-3 h-3 text-red-500" />
                  <span>Muted</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">Offline</span>
          )}

          {/* Host remove participant button */}
          {isHost && !isSelf && onRemove && (
            <button
              onClick={() => onRemove(participant.participant_id || (participant as any).id)}
              title="Remove participant from meeting"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1 cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
