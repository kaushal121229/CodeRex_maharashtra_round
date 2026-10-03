/**
 * Central environment configuration for Roundtable Cloud Meeting.
 * Supports local development and production cloud deployment URLs.
 */

export function getApiBaseUrl(): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) {
    return envApi.replace(/\/+$/, '');
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

  // Derive from current window origin
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return participantId
    ? `${protocol}//${host}/ws/${cleanRoom}/${participantId}`
    : `${protocol}//${host}/ws/${cleanRoom}`;
}

export function getPublicAppUrl(): string {
  const envApp = import.meta.env.VITE_APP_URL;
  if (envApp) {
    return envApp.replace(/\/+$/, '');
  }
  return window.location.origin;
}
