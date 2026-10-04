import React from 'react';
import { Radio, Users, Smartphone, Layers, ArrowRight, Zap, Shield, Sparkles, CheckCircle2, Mic, Activity } from 'lucide-react';

interface LandingPageProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateClick, onJoinClick }) => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden animate-in fade-in duration-500">
      {/* Hero Badge */}
      <div className="inline-flex items-center space-x-2.5 px-4.5 py-2 rounded-full glass-card border-indigo-200 text-indigo-700 text-xs font-semibold mb-8 shadow-md shadow-indigo-500/10 animate-in slide-in-from-top-3 duration-500">
        <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
        <span className="tracking-wide">Multi-Device Collaborative Live Captioning Mesh</span>
      </div>

      {/* Main Headline */}
      <div className="text-center max-w-4xl mx-auto space-y-5">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
          Live captions for <br />
          <span className="gradient-accent drop-shadow-xs">
            group conversations.
          </span>
        </h1>
        <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Traditional captioning fails when multiple people speak in a room. Roundtable turns nearby phones and laptops into an intelligent microphone mesh for speaker-attributed, low-latency captions.
        </p>
      </div>

      {/* Call to Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 w-full max-w-md">
        <button
          onClick={onCreateClick}
          className="w-full sm:w-auto flex items-center justify-center space-x-2.5 px-8 py-4 rounded-2xl glass-btn-primary text-white font-bold text-base shadow-xl shadow-indigo-500/25 cursor-pointer"
        >
          <Radio className="w-5 h-5" />
          <span>Create New Session</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        <button
          onClick={onJoinClick}
          className="w-full sm:w-auto flex items-center justify-center space-x-2.5 px-8 py-4 rounded-2xl glass-btn-secondary text-slate-700 font-bold text-base shadow-md cursor-pointer"
        >
          <Smartphone className="w-5 h-5 text-indigo-600" />
          <span>Join with Code / QR</span>
        </button>
      </div>

      {/* Interactive Architecture Glassmorphic Preview */}
      <div className="w-full max-w-4xl mt-16 p-6 rounded-3xl glass-card-glow shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-live-pulse" />
            <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
              Live Mesh Preview #RT-48291
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono">
            <span className="flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>4 Nodes Active</span>
            </span>
            <span>•</span>
            <span className="text-emerald-600 flex items-center space-x-1 font-semibold">
              <Activity className="w-3.5 h-3.5" />
              <span>0.3s Latency</span>
            </span>
          </div>
        </div>

        {/* Mock Captions with Overlap */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl glass-card border border-slate-200/80 flex items-start space-x-3 hover:border-emerald-500/40 transition-colors shadow-xs">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md shadow-emerald-500/20">
              S
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-700">Saish (Laptop Mic)</span>
                <span className="text-[10px] text-slate-400 font-mono">[00:12]</span>
              </div>
              <p className="text-[15px] text-slate-800 mt-0.5 leading-relaxed">
                "We should use Python and FastAPI for the backend coordination."
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-slate-200/80 flex items-start space-x-3 hover:border-blue-500/40 transition-colors shadow-xs">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md shadow-blue-500/20">
              R
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-blue-700">Rahul (Phone Mic)</span>
                <span className="text-[10px] text-slate-400 font-mono">[00:15]</span>
              </div>
              <p className="text-[15px] text-slate-800 mt-0.5 leading-relaxed">
                "I agree, and we can stream WebSockets for sub-second live caption delivery."
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl glass-panel-amber border flex items-start space-x-3 shadow-md">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md shadow-purple-500/20">
              A
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-purple-700">Aman (Tablet Mic)</span>
                  <span className="text-[10px] text-slate-500 font-mono">[00:18]</span>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 border border-amber-500/40 font-semibold flex items-center space-x-1 shadow-xs">
                  <Layers className="w-3 h-3 text-amber-600" />
                  <span>Overlap Handled</span>
                </span>
              </div>
              <p className="text-[15px] text-slate-800 mt-0.5 leading-relaxed">
                "What about using SQLite for zero-setup local hackathon deployment?"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16 w-full">
        <div className="p-6 rounded-3xl glass-card-interactive shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center mb-4 shadow-sm">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Special Hardware</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every participant simply opens Roundtable on their phone or laptop. Their device immediately joins as a distributed microphone node.
          </p>
        </div>

        <div className="p-6 rounded-3xl glass-card-interactive shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center mb-4 shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Simultaneous Speech Separation</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            When two people talk at once, multi-device energy attribution isolates each speaker stream rather than jumbling words together.
          </p>
        </div>

        <div className="p-6 rounded-3xl glass-card-interactive shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 border border-pink-200/80 flex items-center justify-center mb-4 shadow-sm">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Real Measured Metrics</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Word Error Rate (WER) benchmarker, speaker attribution accuracy tracker, and live end-to-end latency measurement without fake data.
          </p>
        </div>
      </div>
    </div>
  );
};
