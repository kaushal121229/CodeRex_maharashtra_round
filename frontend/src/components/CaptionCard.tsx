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
      className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
        segment.is_overlap
          ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5'
          : isLatest
          ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : 'bg-slate-900/60 border-white/5 hover:border-white/15'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        {/* Speaker Info */}
        <div className="flex items-center space-x-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {segment.speaker_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-100">
                {segment.speaker_name}
              </span>

              {/* Overlapping speech indicator */}
              {segment.is_overlap && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Layers className="w-2.5 h-2.5" />
                  <span>
                    Overlap {segment.overlap_with ? `w/ ${segment.overlap_with}` : 'detected'}
                  </span>
                </span>
              )}
            </div>

            {segment.device_id && (
              <span className="text-[10px] text-slate-400 font-mono">
                mic: {segment.device_id}
              </span>
            )}
          </div>
        </div>

        {/* Timestamps & Telemetry */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          {segment.latency_ms && segment.latency_ms > 0 && (
            <span className="hidden sm:inline-flex items-center space-x-0.5 text-indigo-400 font-mono">
              <Zap className="w-3 h-3" />
              <span>{Math.round(segment.latency_ms)}ms</span>
            </span>
          )}

          <span className="inline-flex items-center space-x-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatTime(segment.start_timestamp)}</span>
          </span>

          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              confidencePercent >= 90
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {confidencePercent}%
          </span>
        </div>
      </div>

      {/* Spoken Text */}
      <p className="text-slate-100 text-base leading-relaxed pl-9 font-normal">
        {segment.text}
      </p>
    </div>
  );
};
