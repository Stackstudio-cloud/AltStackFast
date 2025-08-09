import { describe, it, expect } from 'vitest';
import { apiFetch } from './lib/apiClient';

describe('apiClient', () => {
  it('builds base url and returns JSON for health endpoint (mocked)', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => ({ ok: true, text: async () => '"ok"' });
      const res = await apiFetch('/healthz');
      expect(res).toBe('ok');
    } finally {
      global.fetch = originalFetch;
    }
  });
});


