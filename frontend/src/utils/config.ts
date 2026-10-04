/**
 * Central environment configuration for Roundtable Cloud Meeting.
 * Supports switching between Online Cloud Server, Localhost Server, and Custom LAN Server.
 */

export const DEFAULT_PUBLIC_BACKEND_URL = 'https://dozen-cool-coming-spirits.trycloudflare.com';
export const LOCALHOST_BACKEND_URL = 'http://localhost:8000';

export type ServerTarget = 'online' | 'localhost' | 'custom';

export function getApiBaseUrl(): string {
  let envApi = import.meta.env.VITE_API_URL;
  if (envApi && typeof envApi === 'string' && envApi.trim()) {
    envApi = envApi.trim().replace(/\/+$/, '');
    if (!envApi.startsWith('http://') && !envApi.startsWith('https://')) {
      envApi = `https://${envApi}`;
    }
    return envApi;
  }

  // Check localStorage runtime override
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('roundtable_api_url');
    if (stored && stored.trim()) {
      let url = stored.trim().replace(/\/+$/, '');
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      return url;
    }

    // Local development fallback
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }

  return DEFAULT_PUBLIC_BACKEND_URL;
}

export function getCurrentServerTarget(): ServerTarget {
  if (typeof window === 'undefined') return 'online';
  const stored = localStorage.getItem('roundtable_api_url');
  if (!stored) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'localhost';
    }
    return 'online';
  }
  if (stored.includes('localhost') || stored.includes('127.0.0.1')) {
    return 'localhost';
  }
  if (stored === DEFAULT_PUBLIC_BACKEND_URL) {
    return 'online';
  }
  return 'custom';
}

export function setServerTarget(target: ServerTarget, customUrl?: string): string {
  if (typeof window === 'undefined') return DEFAULT_PUBLIC_BACKEND_URL;
  let targetUrl = DEFAULT_PUBLIC_BACKEND_URL;

  if (target === 'online') {
    localStorage.removeItem('roundtable_api_url');
    targetUrl = DEFAULT_PUBLIC_BACKEND_URL;
  } else if (target === 'localhost') {
    localStorage.setItem('roundtable_api_url', LOCALHOST_BACKEND_URL);
    targetUrl = LOCALHOST_BACKEND_URL;
  } else if (target === 'custom' && customUrl) {
    let clean = customUrl.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    localStorage.setItem('roundtable_api_url', clean);
    targetUrl = clean;
  }

  return targetUrl;
}

export function setCustomApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (url.trim()) {
      localStorage.setItem('roundtable_api_url', url.trim());
    } else {
      localStorage.removeItem('roundtable_api_url');
    }
  }
}

export function getWsBaseUrl(roomId: string, _participantId?: string): string {
  const cleanRoom = encodeURIComponent(roomId.trim().toUpperCase());
  let envWs = import.meta.env.VITE_WS_URL;
  
  // 1. Explicit VITE_WS_URL
  if (envWs && typeof envWs === 'string' && envWs.trim()) {
    envWs = envWs.trim().replace(/\/+$/, '');
    if (envWs.startsWith('https://')) {
      envWs = envWs.replace(/^https:\/\//, 'wss://');
    } else if (envWs.startsWith('http://')) {
      envWs = envWs.replace(/^http:\/\//, 'ws://');
    } else if (!envWs.startsWith('ws://') && !envWs.startsWith('wss://')) {
      envWs = `wss://${envWs}`;
    }
    return `${envWs}/ws/${cleanRoom}`;
  }

  // 2. Automatically derive WebSocket URL from getApiBaseUrl()
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    const wsBase = apiBase
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://');
    return `${wsBase}/ws/${cleanRoom}`;
  }

  return `ws://localhost:8000/ws/${cleanRoom}`;
}

export function getPublicAppUrl(): string {
  let envApp = import.meta.env.VITE_APP_URL;
  if (envApp && typeof envApp === 'string' && envApp.trim()) {
    envApp = envApp.trim().replace(/\/+$/, '');
    if (!envApp.startsWith('http://') && !envApp.startsWith('https://')) {
      envApp = `https://${envApp}`;
    }
    return envApp;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function isCloudBackendConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}
