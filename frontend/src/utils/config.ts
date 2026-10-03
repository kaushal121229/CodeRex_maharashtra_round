/**
 * Central environment configuration for Roundtable Cloud Meeting.
 * Supports local development and production cloud deployment URLs.
 */

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

  return '';
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

  // 2. Automatically derive WebSocket URL from VITE_API_URL
  const apiBase = getApiBaseUrl();
  if (apiBase && !apiBase.includes('localhost') && !apiBase.includes('127.0.0.1')) {
    const derivedWs = apiBase.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    return `${derivedWs}/ws/${cleanRoom}`;
  }

  // 3. Localhost development fallback
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `ws://${host}:8000/ws/${cleanRoom}`;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/${cleanRoom}`;
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
