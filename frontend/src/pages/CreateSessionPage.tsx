import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Radio, Copy, Check, ArrowRight, ArrowLeft, Smartphone, ShieldCheck, Sparkles } from 'lucide-react';
import { getOrCreateDeviceId } from '../utils/deviceUtils';

interface CreateSessionPageProps {
  onSessionCreated: (sessionCode: string, hostParticipant: any) => void;
  onBack: () => void;
}

export const CreateSessionPage: React.FC<CreateSessionPageProps> = ({
  onSessionCreated,
  onBack,
}) => {
  const [title, setTitle] = useState('Roundtable Discussion');
  const [hostName, setHostName] = useState('Host');
  const [isLoading, setIsLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceId = getOrCreateDeviceId();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          host_name: hostName,
          device_id: deviceId,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Failed to create session (${resp.statusText})`);
      }

      const data = await resp.json();
      setCreatedSession(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error creating session');
    } finally {
      setIsLoading(false);
    }
  };

  const joinUrl = createdSession
    ? `${window.location.origin}/join?session=${encodeURIComponent(createdSession.code)}`
    : '';

  const handleCopy = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnterDashboard = () => {
    if (createdSession && createdSession.participants?.[0]) {
      onSessionCreated(createdSession.code, createdSession.participants[0]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl">
        {/* Back Link */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {!createdSession ? (
          /* Session Creation Form */
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20">
                <Radio className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white">Create a Roundtable</h2>
              <p className="text-sm text-slate-400 mt-1">
                Start a session and invite nearby participants to act as microphone nodes.
              </p>
            </div>

            {error && (
              <div className="p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Session Topic / Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Engineering Architecture Sync"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Your Display Name (Host)
                </label>
                <input
                  type="text"
                  required
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g., Alex Johnson"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-indigo-400 shrink-0" />
                <div className="text-xs">
                  <span className="text-slate-300 font-medium block">Host Microphone Node</span>
                  <span className="text-slate-400 font-mono text-[11px] truncate block">
                    Device ID: {deviceId}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span>Generating Session & QR...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Session & QR Code</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Session Created - QR and Join Link */
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Roundtable Ready!</h2>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              Invite nearby people to scan this QR code on their phone or join with code.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-inner mb-6 mx-auto max-w-[260px]">
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
              <div className="mt-2 text-center">
                <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider font-semibold block">
                  Session Code
                </span>
                <span className="text-xl font-mono font-extrabold text-slate-900 tracking-wider">
                  {createdSession.code}
                </span>
              </div>
            </div>

            {/* Copy Link */}
            <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-white/5 mb-6 text-left">
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="bg-transparent text-xs text-slate-300 w-full focus:outline-none font-mono truncate px-2"
              />
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Enter Live Roundtable */}
            <button
              onClick={handleEnterDashboard}
              className="w-full flex items-center justify-center space-x-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-base shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <span>Enter Live Roundtable as Host</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
