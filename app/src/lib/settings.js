// Settings persisted to localStorage, with .env defaults

const STORAGE_KEY = 'ppe-admin-settings';

const defaults = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  theme: 'system',
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    cache = { ...defaults, ...(stored ? JSON.parse(stored) : {}) };
  } catch {
    cache = { ...defaults };
  }
  return cache;
}

export function updateSettings(patch) {
  cache = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
  // Notify listeners
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: cache }));
}

export function resetSettings() {
  cache = { ...defaults };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: cache }));
}
