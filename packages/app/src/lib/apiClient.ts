const DEFAULT_TIMEOUT_MS = 15000;

const getBaseUrl = () => {
  // Vite env is injected at build-time
  // Fallback to production API domain if not provided
  return import.meta.env.VITE_API_URL || 'https://stackfast-api.vercel.app';
};

export async function apiFetch(path: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
