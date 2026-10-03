import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Radio, Copy, Check, ArrowRight, ArrowLeft, Smartphone, ShieldCheck, Sparkles, Hash, Link as LinkIcon, QrCode } from 'lucide-react';
import { getOrCreateDeviceId } from '../utils/deviceUtils';
import { getApiBaseUrl, getPublicAppUrl } from '../utils/config';

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

  const deviceId = getOrCreateDeviceId();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const apiBase = getApiBaseUrl();
    console.log('[ROOM] Creating room');

    try {
      const resp = await fetch(`${apiBase}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          host_name: hostName,
          device_id: deviceId,
        }),
      });

      if (!resp.ok) {
        const errDetail = await resp.text();
        throw new Error(`Failed to create meeting room: ${errDetail || resp.statusText}`);
      }

      const data = await resp.json();
      console.log('[ROOM] Room created', data.room_id || data.code);
      setCreatedSession(data);
    } catch (err: any) {
      console.error('[ROOM] Error creating room:', err);
      setError(err.message || 'Error creating meeting room');
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
              <h2 className="text-2xl font-bold text-white">Create Cloud Meeting</h2>
              <p className="text-sm text-slate-400 mt-1">
                Start a shared internet meeting room. Nearby and remote devices can join with Room ID or QR.
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
                  Meeting Topic / Title
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
                  placeholder="e.g., Saish (Host)"
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
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-1 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Meeting Room Created!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Share this Room ID or QR code with participants on any phone, Wi-Fi, or mobile network.
              </p>
            </div>

            {/* Room ID Badge */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-indigo-500/30">
              <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider font-semibold block">
                Room ID
              </span>
              <span className="text-2xl font-mono font-extrabold text-indigo-300 tracking-wider">
                {roomId}
              </span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl shadow-inner mx-auto max-w-[240px]">
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
              <span className="text-[11px] font-mono text-slate-600 mt-2 font-semibold">
                Scan with phone camera
              </span>
            </div>

            {/* Action Buttons: Copy Room ID & Copy Join Link */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-white/10 transition-colors"
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
                className="flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-colors"
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

            <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
              <span className="text-[11px] text-slate-400 font-mono break-all block truncate">
                {joinUrl}
              </span>
            </div>

            {/* Enter Live Roundtable */}
            <button
              onClick={handleEnterDashboard}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
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
