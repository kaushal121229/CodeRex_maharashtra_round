import React from 'react';
import { Layers, Clock, Zap } from 'lucide-react';
import { TranscriptSegment } from '../types';
import { formatTime } from '../utils/deviceUtils';

interface CaptionCardProps {
  segment: TranscriptSegment;
  isLatest?: boolean;
}

export const CaptionCard: React.FC<CaptionCardProps> = ({ segment, isLatest }) => {
  const avatarColor = segment.avatar_color || '#6366F1';
  const confidencePercent = Math.round((segment.confidence || 0.95) * 100);

  return (
    <div
      className={`group relative p-4.5 rounded-2xl transition-all duration-300 animate-caption-enter ${
        segment.is_overlap
          ? 'glass-panel-amber'
          : isLatest
          ? 'glass-card-glow border-indigo-500/50 shadow-xl shadow-indigo-500/10'
          : 'glass-card-interactive hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between mb-2.5">
        {/* Speaker Info with Glowing Avatar */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-105 ${
                isLatest ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 animate-speaking-ripple' : ''
              }`}
              style={{
                backgroundColor: avatarColor,
                boxShadow: `0 0 16px ${avatarColor}40`,
              }}
            >
              {segment.speaker_name.charAt(0).toUpperCase()}
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                {segment.speaker_name}
              </span>

              {/* Overlapping speech indicator with animated badge */}
              {segment.is_overlap && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse">
                  <Layers className="w-2.5 h-2.5" />
                  <span>
                    Overlap {segment.overlap_with ? `w/ ${segment.overlap_with}` : 'Separated'}
                  </span>
                </span>
              )}

              {isLatest && !segment.is_overlap && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping mr-0.5" />
                  <span>Just now</span>
                </span>
              )}
            </div>

            {segment.device_id && (
              <span className="text-[10px] text-slate-400 font-mono tracking-tight">
                node: {segment.device_id}
              </span>
            )}
          </div>
        </div>

        {/* Timestamps & Telemetry with Glass Badges */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          {segment.latency_ms && segment.latency_ms > 0 && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
              <Zap className="w-3 h-3 text-indigo-400" />
              <span>{Math.round(segment.latency_ms)}ms</span>
            </span>
          )}

          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-950/40 font-mono border border-white/5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatTime(segment.start_timestamp)}</span>
          </span>

          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border ${
              confidencePercent >= 90
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {confidencePercent}%
          </span>
        </div>
      </div>

      {/* Spoken Text */}
      <p className="text-slate-100 text-[15px] leading-relaxed pl-11 font-normal select-text">
        {segment.text}
      </p>
    </div>
  );
};
