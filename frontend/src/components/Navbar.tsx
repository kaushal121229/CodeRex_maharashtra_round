import React from 'react';
import { Mic, Radio, FileText, BarChart3, LogOut, QrCode } from 'lucide-react';

interface NavbarProps {
  sessionCode?: string;
  activeTab: 'dashboard' | 'transcript' | 'evaluation';
  onTabChange: (tab: 'dashboard' | 'transcript' | 'evaluation') => void;
  onOpenQR?: () => void;
  onLeaveSession?: () => void;
  isHost?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  sessionCode,
  activeTab,
  onTabChange,
  onOpenQR,
  onLeaveSession,
  isHost,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-lg shadow-indigo-500/25">
            <Radio className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white">Roundtable</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                Live Mic Mesh
              </span>
            </div>
            {sessionCode && (
              <span className="text-xs text-slate-400 font-mono">
                Session: <strong className="text-indigo-400">{sessionCode}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Navigation tabs if in session */}
        {sessionCode && (
          <nav className="hidden md:flex items-center space-x-1 p-1 bg-slate-900/90 rounded-xl border border-white/10">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Live Roundtable</span>
            </button>

            <button
              onClick={() => onTabChange('transcript')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'transcript'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Full Transcript</span>
            </button>

            <button
              onClick={() => onTabChange('evaluation')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'evaluation'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Evaluation & Metrics</span>
            </button>
          </nav>
        )}

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {sessionCode && onOpenQR && (
            <button
              onClick={onOpenQR}
              title="Show QR Code to invite nearby devices"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-white/10 transition-colors"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Invite Devices</span>
            </button>
          )}

          {sessionCode && onLeaveSession && (
            <button
              onClick={onLeaveSession}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{isHost ? 'End Session' : 'Leave'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
