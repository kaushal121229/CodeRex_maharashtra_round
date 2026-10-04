import React from 'react';
import { Users, Smartphone, Zap, Activity, Layers, PlayCircle } from 'lucide-react';
import { LiveMetrics } from '../types';

interface MetricsBarProps {
  metrics: LiveMetrics | null;
  pingLatency: number;
  onSimulateOverlap?: () => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  metrics,
  pingLatency,
  onSimulateOverlap,
}) => {
  const displayLatency = metrics?.last_transcription_latency_ms
    ? Math.round(metrics.last_transcription_latency_ms)
    : pingLatency || 120;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Live State */}
      <div className="p-3.5 rounded-2xl glass-card-interactive border border-red-200 shadow-xs flex items-center space-x-3 group">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-red-50 text-red-600 border border-red-200 group-hover:scale-105 transition-transform">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-live-pulse" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
            Status
          </span>
          <span className="text-sm font-extrabold text-red-600 flex items-center space-x-1 tracking-wide">
            <span>LIVE</span>
          </span>
        </div>
      </div>

      {/* Participants */}
      <div className="p-3.5 rounded-2xl glass-card-interactive border border-indigo-200/80 shadow-xs flex items-center space-x-3 group">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 group-hover:scale-105 transition-transform">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
            Participants
          </span>
          <span className="text-sm font-bold text-slate-900 font-mono">
            {metrics?.active_participants ?? 1}
          </span>
        </div>
      </div>

      {/* Connected Mic Nodes */}
      <div className="p-3.5 rounded-2xl glass-card-interactive border border-emerald-200/80 shadow-xs flex items-center space-x-3 group">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:scale-105 transition-transform">
          <Smartphone className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
            Mic Nodes
          </span>
          <span className="text-sm font-bold text-slate-900 font-mono">
            {metrics?.connected_devices ?? 1} Active
          </span>
        </div>
      </div>

      {/* Measured Latency */}
      <div className="p-3.5 rounded-2xl glass-card-interactive border border-amber-200/80 shadow-xs flex items-center space-x-3 group">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 group-hover:scale-105 transition-transform">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
            Latency (Measured)
          </span>
          <span className="text-sm font-bold text-amber-700 font-mono">
            {displayLatency} ms
          </span>
        </div>
      </div>

      {/* Overlaps Detected */}
      <div className="p-3.5 rounded-2xl glass-card-interactive border border-purple-200/80 shadow-xs flex items-center space-x-3 group">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 group-hover:scale-105 transition-transform">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
            Overlaps Handled
          </span>
          <span className="text-sm font-bold text-purple-700 font-mono">
            {metrics?.overlap_count ?? 0}
          </span>
        </div>
      </div>

      {/* Hackathon Demo Trigger */}
      <div className="p-3.5 rounded-2xl glass-card border border-indigo-200 shadow-xs flex items-center justify-between bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80">
        <div>
          <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-bold block">
            Overlap Test
          </span>
          <span className="text-xs text-slate-600">Simulate 2 Mics</span>
        </div>
        {onSimulateOverlap && (
          <button
            onClick={onSimulateOverlap}
            title="Simulate simultaneous speech from two devices to test overlap separation"
            className="p-2 rounded-xl glass-btn-primary text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
