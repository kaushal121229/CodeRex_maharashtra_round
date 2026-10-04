import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Radio, Copy, Check, ArrowRight, ArrowLeft, Smartphone, ShieldCheck, Sparkles, Hash, Link as LinkIcon, QrCode } from 'lucide-react';
import { getOrCreateDeviceId } from '../utils/deviceUtils';
import { getApiBaseUrl, getPublicAppUrl, setCustomApiUrl } from '../utils/config';

interface CreateSessionPageProps {
  onSessionCreated: (sessionCode: string, hostParticipant: any) => void;
  onBack: () => void;
}

export const CreateSessionPage: React.FC<CreateSessionPageProps> = ({
  onSessionCreated,
  onBack,
}) => {
  const [title, setTitle] = useState('Roundtable Meeting');
  const [hostName, setHostName] = useState('Host');
  const [isLoading, setIsLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendInput, setBackendInput] = useState(getApiBaseUrl() || '');

  const deviceId = getOrCreateDeviceId();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const apiBase = getApiBaseUrl();
    console.log('[ROOM] Creating room');

    if (!apiBase) {
      setError('Unable to reach cloud backend. Please check your internet connection.');
      setIsLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${apiBase}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({
          title,
          host_name: hostName,
          device_id: deviceId,
        }),
      });

      if (!resp.ok) {
        const errDetail = await resp.text();
        throw new Error(errDetail || resp.statusText || 'Failed to create meeting room');
      }

      const data = await resp.json();
      console.log('[ROOM] Room created', data.room_id || data.code);
      setCreatedSession(data);
    } catch (err: any) {
      console.error('[ROOM] Error creating room:', err);
      setError(err.message || 'Error connecting to meeting server');
    } finally {
      setIsLoading(false);
    }
  };

  const roomId = createdSession ? (createdSession.room_id || createdSession.code) : '';
  const appBase = getPublicAppUrl();
  const joinUrl = roomId ? `${appBase}/join/${encodeURIComponent(roomId)}` : '';

  const handleCopyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleEnterDashboard = () => {
    if (createdSession && createdSession.participants?.[0]) {
      onSessionCreated(roomId, createdSession.participants[0]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg p-6 sm:p-10 rounded-3xl glass-card-glow shadow-2xl animate-fade-in relative overflow-hidden">
        {/* Ambient Top Rim Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/80 to-transparent" />

        {/* Back Link */}
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </button>

        {!createdSession ? (
          /* Session Creation Form */
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                <Radio className="w-7 h-7 text-indigo-400 animate-pulse" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Create Cloud Meeting</h2>
              <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
                Host a real-time collaborative audio mesh. Nearby & remote devices synchronize speech instantly.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed glass-card">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Meeting Topic / Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Engineering Architecture Sync"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
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
                  placeholder="e.g., Saish (Host)"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="p-4 rounded-2xl glass-card border border-white/5 flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-xs">
                  <span className="text-slate-200 font-semibold block">Host Microphone Node</span>
                  <span className="text-slate-400 font-mono text-[11px] truncate block mt-0.5">
                    ID: {deviceId}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl glass-btn-primary text-white font-semibold text-sm shadow-xl shadow-indigo-500/25 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <span>Creating Cloud Room...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Create Meeting Room</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Room Created - Controls: Copy Room ID, Copy Join Link, QR Code */
          <div className="text-center animate-fade-in space-y-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Meeting Room Created!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Share this Room ID or QR code with participants on any phone, Wi-Fi, or cellular network.
              </p>
            </div>

            {/* Room ID Badge */}
            <div className="p-4 rounded-2xl glass-card-glow border border-indigo-500/40">
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider font-semibold block">
                Room ID
              </span>
              <span className="text-3xl font-mono font-extrabold text-white tracking-widest mt-1 block">
                {roomId}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl shadow-2xl mx-auto max-w-[240px] border-4 border-indigo-500/30">
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
              <span className="text-[11px] font-mono text-slate-700 mt-2 font-bold tracking-tight">
                Scan with phone camera
              </span>
            </div>

            {/* Action Buttons: Copy Room ID & Copy Join Link */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl glass-btn-secondary text-white text-xs font-semibold cursor-pointer"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ID Copied</span>
                  </>
                ) : (
                  <>
                    <Hash className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Copy Room ID</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl glass-btn-primary text-white text-xs font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Copy Join Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-2.5 rounded-xl glass-card border border-white/5">
              <span className="text-[11px] text-slate-400 font-mono break-all block truncate">
                {joinUrl}
              </span>
            </div>

            {/* Enter Live Roundtable */}
            <button
              onClick={handleEnterDashboard}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer"
            >
              <span>Enter Meeting as Host</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
