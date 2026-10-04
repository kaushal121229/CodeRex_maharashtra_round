import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface OverlapBannerProps {
  speakers: string;
  onDismiss?: () => void;
}

export const OverlapBanner: React.FC<OverlapBannerProps> = ({ speakers, onDismiss }) => {
  if (!speakers) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 rounded-2xl glass-panel-amber text-amber-200 text-sm shadow-xl animate-caption-enter">
      <div className="flex items-center space-x-3">
        <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 animate-bounce" />
        </div>
        <div>
          <span className="font-semibold text-amber-100">Overlapping speech detected:</span>{' '}
          <span className="text-amber-200 font-medium">{speakers} speaking simultaneously</span>
          <span className="hidden sm:inline text-xs text-amber-300/80 ml-2 font-mono">
            (Streams separated & attributed via multi-device mesh)
          </span>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-xl text-amber-300 hover:text-white hover:bg-amber-500/30 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
