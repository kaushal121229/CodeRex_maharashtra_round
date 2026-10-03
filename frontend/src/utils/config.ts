/**
 * Central environment configuration for Roundtable Cloud Meeting.
 * Supports local development and production cloud deployment URLs.
 */

export function getApiBaseUrl(): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) {
    return envApi.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }
  return '';
}

export function getWsBaseUrl(roomId: string, participantId?: string): string {
  const envWs = import.meta.env.VITE_WS_URL;
  const cleanRoom = encodeURIComponent(roomId.trim().toUpperCase());
  
  if (envWs) {
    const base = envWs.replace(/\/+$/, '');
    return participantId ? `${base}/ws/${cleanRoom}/${participantId}` : `${base}/ws/${cleanRoom}`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return participantId
        ? `ws://${host}:8000/ws/${cleanRoom}/${participantId}`
        : `ws://${host}:8000/ws/${cleanRoom}`;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return participantId
      ? `${protocol}//${window.location.host}/ws/${cleanRoom}/${participantId}`
      : `${protocol}//${window.location.host}/ws/${cleanRoom}`;
  }

  return `ws://localhost:8000/ws/${cleanRoom}`;
}

export function getPublicAppUrl(): string {
  const envApp = import.meta.env.VITE_APP_URL;
  if (envApp) {
    return envApp.replace(/\/+$/, '');
  }
  return window.location.origin;
}
