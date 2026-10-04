import React, { useState } from 'react';
import { Mic, Radio, FileText, BarChart3, LogOut, QrCode, Globe, Laptop, Server } from 'lucide-react';
import { getCurrentServerTarget } from '../utils/config';
import { ServerConfigModal } from './ServerConfigModal';

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
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const currentTarget = getCurrentServerTarget();

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/75 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand / Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 shadow-md shadow-indigo-500/20">
              <Radio className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">Roundtable</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold shadow-xs">
                  Live Mic Mesh
                </span>
              </div>
              {sessionCode && (
                <span className="text-xs text-slate-500 font-mono">
                  Session: <strong className="text-indigo-600 font-bold">{sessionCode}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Navigation tabs if in session */}
          {sessionCode && (
            <nav className="hidden md:flex items-center space-x-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Live Roundtable</span>
              </button>

              <button
                onClick={() => onTabChange('transcript')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'transcript'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Full Transcript</span>
              </button>

              <button
                onClick={() => onTabChange('evaluation')}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'evaluation'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Evaluation & Metrics</span>
              </button>
            </nav>
          )}

          {/* Action Controls & Server Switcher */}
          <div className="flex items-center space-x-2.5">
            {/* Server Mode Switcher Button */}
            <button
              onClick={() => setIsServerModalOpen(true)}
              title="Switch Backend Server (Online Cloud vs Localhost)"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-btn-secondary text-xs font-semibold cursor-pointer shadow-xs"
            >
              {currentTarget === 'localhost' ? (
                <Laptop className="w-3.5 h-3.5 text-amber-600" />
              ) : currentTarget === 'online' ? (
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <Server className="w-3.5 h-3.5 text-purple-600" />
              )}
              <span className="hidden sm:inline">
                {currentTarget === 'localhost' ? 'Localhost' : currentTarget === 'online' ? 'Online Server' : 'Custom Server'}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            </button>

            {sessionCode && onOpenQR && (
              <button
                onClick={onOpenQR}
                title="Show QR Code to invite nearby devices"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-btn-secondary text-xs font-semibold cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            {sessionCode && onLeaveSession && (
              <button
                onClick={onLeaveSession}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isHost ? 'End' : 'Leave'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Server Configuration Modal */}
      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </>
  );
};
