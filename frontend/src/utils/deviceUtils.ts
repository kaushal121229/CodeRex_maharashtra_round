export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'roundtable_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    const randomHex = Math.random().toString(36).substring(2, 10);
    const platform = /Mobi|Android/i.test(navigator.userAgent) ? 'phone' : 'laptop';
    deviceId = `${platform}-${randomHex}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export function getDeviceLabel(): string {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return isMobile ? 'Mobile Mic Node' : 'Laptop Mic Node';
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
