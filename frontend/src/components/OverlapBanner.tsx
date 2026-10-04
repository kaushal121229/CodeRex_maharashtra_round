import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface OverlapBannerProps {
  speakers: string;
  onDismiss?: () => void;
}

export const OverlapBanner: React.FC<OverlapBannerProps> = ({ speakers, onDismiss }) => {
  if (!speakers) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 rounded-2xl glass-panel-amber text-amber-900 text-sm shadow-xl animate-caption-enter">
      <div className="flex items-center space-x-3">
        <div className="p-1.5 rounded-xl bg-amber-100 text-amber-700 border border-amber-300">
          <AlertTriangle className="w-4 h-4 animate-bounce text-amber-600" />
        </div>
        <div>
          <span className="font-bold text-amber-950">Overlapping speech detected:</span>{' '}
          <span className="text-amber-900 font-semibold">{speakers} speaking simultaneously</span>
          <span className="hidden sm:inline text-xs text-amber-800/90 ml-2 font-mono font-medium">
            (Streams separated & attributed via multi-device mesh)
          </span>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-xl text-amber-700 hover:text-amber-950 hover:bg-amber-100 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
