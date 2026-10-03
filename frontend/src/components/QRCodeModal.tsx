import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone, Link } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build join URL with current origin
  const joinUrl = `${window.location.origin}/join?session=${encodeURIComponent(sessionCode)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl shadow-indigo-500/10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Add Nearby Microphone Node</h3>
          <p className="text-sm text-slate-400 mt-1">
            Turn your phone or tablet into a coordinated microphone for this roundtable.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-inner mb-6">
          <QRCodeSVG
            value={joinUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
          <div className="mt-3 text-center">
            <span className="text-xs uppercase font-mono text-slate-500 tracking-wider font-semibold block">
              Roundtable Code
            </span>
            <span className="text-xl font-mono font-bold text-slate-900 tracking-wider">
              {sessionCode}
            </span>
          </div>
        </div>

        {/* Copy Link Row */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-white/5">
            <Link className="w-4 h-4 text-indigo-400 ml-2 shrink-0" />
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="bg-transparent text-xs text-slate-300 w-full focus:outline-none font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Scan from iOS Safari or Android Chrome. No app download or special hardware required!
          </p>
        </div>
      </div>
    </div>
  );
};
