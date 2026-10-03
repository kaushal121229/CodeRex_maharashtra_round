import React from 'react';
import { Radio, Users, Smartphone, Layers, ArrowRight, Zap, Shield, Sparkles, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCreateClick, onJoinClick }) => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/20 to-pink-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Badge */}
      <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8 backdrop-blur-md">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Collaborative Multi-Device Live Captioning Mesh</span>
      </div>

      {/* Main Headline */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
          Live captions for <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            group conversations.
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
          Traditional captioning fails when multiple people speak in a room. Roundtable turns nearby phones and laptops into an intelligent microphone mesh for speaker-attributed, low-latency captions.
        </p>
      </div>

      {/* Call to Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 w-full max-w-md">
        <button
          onClick={onCreateClick}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-base shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
        >
          <Radio className="w-5 h-5" />
          <span>Create New Session</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        <button
          onClick={onJoinClick}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold text-base border border-white/10 transition-all cursor-pointer"
        >
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <span>Join with Code / QR</span>
        </button>
      </div>

      {/* Interactive Architecture Mock Preview */}
      <div className="w-full max-w-4xl mt-16 p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              Live Mesh Preview #RT-48291
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
            <span>4 Devices Active</span>
            <span>•</span>
            <span className="text-emerald-400">0.4s Latency</span>
          </div>
        </div>

        {/* Mock Captions with Overlap */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-start space-x-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              S
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-emerald-400">Saish (Laptop Mic)</span>
                <span className="text-[10px] text-slate-400 font-mono">[00:12]</span>
              </div>
              <p className="text-sm text-slate-200 mt-0.5">
                "We should use Python and FastAPI for the backend coordination."
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-start space-x-3">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              R
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-blue-400">Rahul (Phone Mic)</span>
                <span className="text-[10px] text-slate-400 font-mono">[00:15]</span>
              </div>
              <p className="text-sm text-slate-200 mt-0.5">
                "I agree, and we can stream WebSockets for sub-second live caption delivery."
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start space-x-3">
            <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              A
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-purple-400">Aman (Tablet Mic)</span>
                  <span className="text-[10px] text-slate-400 font-mono">[00:18]</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⚠ Overlap Handled
                </span>
              </div>
              <p className="text-sm text-slate-200 mt-0.5">
                "What about using SQLite for zero-setup local hackathon deployment?"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16 w-full">
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Special Hardware</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every participant simply opens Roundtable on their phone or laptop. Their device immediately joins as a distributed microphone node.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-purple-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Simultaneous Speech Separation</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            When two people talk at once, multi-device energy attribution isolates each speaker stream rather than jumbling words together.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-pink-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Real Measured Metrics</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Word Error Rate (WER) benchmarker, speaker attribution accuracy tracker, and live end-to-end latency measurement without fake data.
          </p>
        </div>
      </div>
    </div>
  );
};
