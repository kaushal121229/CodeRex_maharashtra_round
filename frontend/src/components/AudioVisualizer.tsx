import React from 'react';

interface AudioVisualizerProps {
  rmsLevel: number;
  isMuted: boolean;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  rmsLevel,
  isMuted,
  barCount = 16,
}) => {
  // Normalize RMS into 0 to 100 percentage
  const normalizedLevel = isMuted ? 0 : Math.min(100, Math.max(5, rmsLevel * 450));

  return (
    <div className="flex items-center space-x-1 h-9 px-2.5 py-1 glass-card bg-white/75 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-inner">
      {Array.from({ length: barCount }).map((_, i) => {
        // Create an organic wave shape across bars
        const distanceToCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const barHeight = Math.max(
          12,
          normalizedLevel * (1 - distanceToCenter * 0.5) * (0.8 + Math.sin(i * 0.8) * 0.2)
        );

        const isActive = normalizedLevel > 15;

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              isMuted
                ? 'bg-slate-200 h-2'
                : isActive
                ? 'bg-gradient-to-t from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                : 'bg-slate-300 h-2'
            }`}
            style={{
              height: isMuted ? '8px' : `${Math.min(26, Math.max(6, barHeight * 0.26))}px`,
            }}
          />
        );
      })}
    </div>
  );
};
