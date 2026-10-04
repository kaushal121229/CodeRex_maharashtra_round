import React, { useState, useEffect } from 'react';
import { Server, Globe, Laptop, Wifi, Check, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  DEFAULT_PUBLIC_BACKEND_URL,
  LOCALHOST_BACKEND_URL,
  getCurrentServerTarget,
  setServerTarget,
  getApiBaseUrl,
  ServerTarget
} from '../utils/config';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerChanged?: (newUrl: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onServerChanged,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<ServerTarget>('online');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latency?: number;
    model?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getCurrentServerTarget();
      setSelectedTarget(current);
      const activeUrl = getApiBaseUrl();
      if (current === 'custom') {
        setCustomUrl(activeUrl);
      } else {
        setCustomUrl('');
      }
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getTargetUrl = (target: ServerTarget): string => {
    if (target === 'online') return DEFAULT_PUBLIC_BACKEND_URL;
    if (target === 'localhost') return LOCALHOST_BACKEND_URL;
    return customUrl.trim() || 'http://localhost:8000';
  };

  const testConnection = async (targetToTest = selectedTarget) => {
    const url = getTargetUrl(targetToTest).replace(/\/+$/, '');
    setIsTesting(true);
    setTestResult(null);

    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${url}/api/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          latency,
          model: data.whisper_model || 'base.en',
          message: 'Server is healthy and ready!',
        });
      } else {
        setTestResult({
          ok: false,
          latency,
          message: `Server returned status ${res.status}`,
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: e.name === 'AbortError' ? 'Connection timed out (6s)' : 'Cannot reach server at this address.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApply = () => {
    const newUrl = setServerTarget(selectedTarget, customUrl);
    if (onServerChanged) {
      onServerChanged(newUrl);
    }
    onClose();
    // Smooth reload to apply backend URL across all WebSocket hooks and API instances
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Backend Server Selection</h3>
              <p className="text-xs text-slate-400">Switch between Online Cloud and Localhost servers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selection Cards */}
        <div className="space-y-3 mb-5">
          {/* 1. Online Cloud Server */}
          <div
            onClick={() => {
              setSelectedTarget('online');
              setTestResult(null);
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedTarget === 'online'
                ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-slate-800/40 border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-xl ${selectedTarget === 'online' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-white">Online Cloud Server</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect multiple phones, tablets, & laptops over Wi-Fi or cellular 4G/5G.
                  </p>
                  <p className="text-[11px] font-mono text-indigo-300/80 mt-1 truncate max-w-xs">
                    {DEFAULT_PUBLIC_BACKEND_URL}
                  </p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedTarget === 'online' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'}`}>
                {selectedTarget === 'online' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* 2. Localhost Server */}
          <div
            onClick={() => {
              setSelectedTarget('localhost');
              setTestResult(null);
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedTarget === 'localhost'
                ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-slate-800/40 border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-xl ${selectedTarget === 'localhost' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-white">Localhost Server</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-mono">
                      Port 8000
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    For local testing when running <code className="text-indigo-300">uvicorn</code> on this computer.
                  </p>
                  <p className="text-[11px] font-mono text-slate-300 mt-1">
                    http://localhost:8000
                  </p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedTarget === 'localhost' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'}`}>
                {selectedTarget === 'localhost' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* 3. Custom Server / Wi-Fi IP */}
          <div
            onClick={() => {
              setSelectedTarget('custom');
              setTestResult(null);
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedTarget === 'custom'
                ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-slate-800/40 border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 w-full">
                <div className={`p-2 rounded-xl shrink-0 ${selectedTarget === 'custom' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="w-full pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-white">Custom Server / LAN IP</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter custom IP or domain (e.g., http://192.168.1.15:8000).
                  </p>
                  {selectedTarget === 'custom' && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="http://192.168.x.x:8000"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center ${selectedTarget === 'custom' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'}`}>
                {selectedTarget === 'custom' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div className={`p-3.5 rounded-2xl mb-4 border text-xs flex items-center justify-between ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.ok && (
              <div className="flex items-center space-x-2 font-mono text-[11px] shrink-0">
                <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-200">
                  {testResult.latency}ms
                </span>
                {testResult.model && (
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {testResult.model}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => testConnection()}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Save & Switch Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
