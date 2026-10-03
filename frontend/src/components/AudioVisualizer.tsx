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
    <div className="flex items-center space-x-1 h-8 px-2 py-1 bg-slate-900/60 rounded-lg border border-white/5">
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
                ? 'bg-slate-700 h-2'
                : isActive
                ? 'bg-gradient-to-t from-indigo-500 to-pink-400'
                : 'bg-slate-600 h-2'
            }`}
            style={{
              height: isMuted ? '8px' : `${Math.min(28, Math.max(6, barHeight * 0.28))}px`,
            }}
          />
        );
      })}
    </div>
  );
};
