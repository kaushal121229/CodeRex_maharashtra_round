import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone, Link, Hash } from 'lucide-react';
import { getPublicAppUrl } from '../utils/config';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionTitle: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  sessionTitle,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  // Build public cloud join URL: https://DOMAIN/join/RT-48291
  const appBase = getPublicAppUrl();
  const joinUrl = `${appBase}/join/${encodeURIComponent(sessionCode)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/95 backdrop-blur-2xl shadow-2xl border border-slate-200/90 text-slate-900">
        {/* Ambient Top Rim Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-200/80 shadow-md shadow-indigo-500/10">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Join Cloud Meeting Room</h3>
          <p className="text-xs text-slate-600 mt-1">
            Any phone, tablet, or laptop can join via mobile data or Wi-Fi.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-xl mx-auto max-w-[240px] mb-6 border-4 border-indigo-100">
          <QRCodeSVG
            value={joinUrl}
            size={190}
            level="H"
            includeMargin={true}
          />
          <div className="mt-3 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider font-bold block">
              Room ID
            </span>
            <span className="text-2xl font-mono font-extrabold text-slate-900 tracking-wider">
              {sessionCode}
            </span>
          </div>
        </div>

        {/* Action Buttons: Copy Room ID & Copy Join Link */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleCopyId}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl glass-btn-secondary text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200/90 hover:bg-slate-100"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Room ID Copied</span>
                </>
              ) : (
                <>
                  <Hash className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Copy Room ID</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl glass-btn-primary text-white text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Link className="w-3.5 h-3.5" />
                  <span>Copy Join Link</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="bg-transparent text-xs text-slate-600 w-full focus:outline-none font-mono truncate px-1"
            />
          </div>

          <p className="text-[11px] text-center text-slate-500">
            Works over cellular data, mobile hotspots, or any network. No shared Wi-Fi needed!
          </p>
        </div>
      </div>
    </div>
  );
};
