import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface OverlapBannerProps {
  speakers: string;
  onDismiss?: () => void;
}

export const OverlapBanner: React.FC<OverlapBannerProps> = ({ speakers, onDismiss }) => {
  if (!speakers) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/40 text-amber-200 text-sm shadow-lg shadow-amber-500/10 animate-fade-in">
      <div className="flex items-center space-x-2.5">
        <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300">
          <AlertTriangle className="w-4 h-4 animate-bounce" />
        </div>
        <div>
          <span className="font-semibold text-amber-100">Overlapping speech detected:</span>{' '}
          <span className="text-amber-200">{speakers} speaking simultaneously</span>
          <span className="hidden sm:inline text-xs text-amber-300/80 ml-2 font-mono">
            (Streams separated & attributed via multi-device coordination)
          </span>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-md text-amber-300 hover:text-white hover:bg-amber-500/30 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
