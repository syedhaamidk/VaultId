/**
 * VaultID — /api/scan backend tests
 *
 * Covers the serverless Groq proxy without touching the network: global
 * fetch is mocked (Supabase token verify + Groq completions), env is
 * stubbed per test, and the module is re-imported fresh so the in-memory
 * rate limiter starts empty each time.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const APP_ORIGIN = 'https://vault-id-pearl.vercel.app';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgo=';

function mockReq({ method = 'POST', origin = APP_ORIGIN, headers = {}, body = undefined } = {}) {
  return {
    method,
    headers: { origin, host: 'vault-id-pearl.vercel.app', ...headers },
    body,
  };
}

function mockRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    end() { this.ended = true; return this; },
  };
  return res;
}

/** Fresh handler import (resets the module-level rate limiter). */
async function loadHandler() {
  vi.resetModules();
  const mod = await import('./scan.js');
  return mod.default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('api/scan — gating', () => {
  it('rejects requests without an Origin header', async () => {
    const handler = await loadHandler();
    const res = mockRes();
    await handler(mockReq({ headers: { origin: undefined, host: undefined } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects cross-origin requests', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    const handler = await loadHandler();
    const res = mockRes();
    await handler(mockReq({ origin: 'https://evil.example.com' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('answers CORS preflight for allowed origins', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    const handler = await loadHandler();
    const res = mockRes();
    await handler(mockReq({ method: 'OPTIONS' }), res);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe(APP_ORIGIN);
    expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });

  it('rejects non-POST methods', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    const handler = await loadHandler();
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe('METHOD_NOT_ALLOWED');
  });

  it('requires a Bearer token', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    const handler = await loadHandler();
    const res = mockRes();
    await handler(mockReq({ body: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});

describe('api/scan — auth + config', () => {
  it('rejects invalid Supabase tokens', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://xyz.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    global.fetch = vi.fn(async () => ({ ok: false }));
    const handler = await loadHandler();
    const res = mockRes();
    await handler(
      mockReq({ headers: { authorization: 'Bearer bad-token' }, body: {} }),
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('reports a missing server key instead of calling Groq', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://xyz.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('GROQ_API_KEY', '');
    const groq = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    global.fetch = vi.fn(async (url) =>
      String(url).includes('/auth/v1/user') ? { ok: true } : groq(url),
    );
    const handler = await loadHandler();
    const res = mockRes();
    await handler(
      mockReq({ headers: { authorization: 'Bearer good-token' }, body: { dataUrl: TINY_PNG } }),
      res,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('NO_SERVER_KEY');
    expect(groq).not.toHaveBeenCalled();
  });

  it('rate-limits the 21st request from one client', async () => {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://xyz.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('GROQ_API_KEY', '');
    global.fetch = vi.fn(async () => ({ ok: true }));
    const handler = await loadHandler();
    const headers = {
      authorization: 'Bearer good-token',
      'x-forwarded-for': '203.0.113.7',
    };
    let first;
    let last;
    for (let i = 0; i < 21; i++) {
      const res = mockRes();
      // eslint-disable-next-line no-await-in-loop
      await handler(mockReq({ headers, body: { dataUrl: TINY_PNG } }), res);
      if (i === 0) first = res;
      last = res;
    }
    expect(first.statusCode).toBe(500); // passed rate gate, failed on key
    expect(last.statusCode).toBe(429);
    expect(last.body.error).toBe('RATE_LIMITED');
  });
});

describe('api/scan — validation + Groq', () => {
  async function authedHandler(groqImpl) {
    vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://xyz.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');
    global.fetch = vi.fn(async (url) =>
      String(url).includes('/auth/v1/user') ? { ok: true } : groqImpl(url),
    );
    return loadHandler();
  }

  const authHeaders = { authorization: 'Bearer good-token' };

  it('rejects missing, malformed, and mismatched images', async () => {
    const handler = await authedHandler(async () => ({ ok: true, json: async () => ({}) }));
    for (const body of [
      {},
      { dataUrl: 'not-an-image' },
      { dataUrl: 'data:image/gif;base64,iVBORw0KGgo=' },
    ]) {
      const res = mockRes();
      // eslint-disable-next-line no-await-in-loop
      await handler(mockReq({ headers: authHeaders, body }), res);
      expect(res.statusCode).toBe(400);
    }
    const mismatch = mockRes();
    await handler(
      mockReq({ headers: authHeaders, body: { dataUrl: TINY_PNG, mimeType: 'image/jpeg' } }),
      mismatch,
    );
    expect(mismatch.statusCode).toBe(400);
  });

  it('rejects oversized images', async () => {
    const handler = await authedHandler(async () => ({ ok: true, json: async () => ({}) }));
    const res = mockRes();
    await handler(
      mockReq({ headers: authHeaders, body: { dataUrl: `data:image/png;base64,${'A'.repeat(3_400_000)}` } }),
      res,
    );
    expect(res.statusCode).toBe(413);
    expect(res.body.error).toBe('TOO_LARGE');
  });

  it('returns sanitized fields on success', async () => {
    const handler = await authedHandler(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              name: 'Passport',
              category: 'not-a-real-category',
              num: 'M1234567',
              by: 'Min. of External Affairs',
              issued: '2021-13-45',
              expires: '2031-08-19',
              notes: `n${'o'.repeat(600)}`,
            }),
          },
        }],
      }),
    }));
    const res = mockRes();
    await handler(
      mockReq({ headers: authHeaders, body: { dataUrl: TINY_PNG } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Passport',
      category: 'identity', // unknown categories fall back safely
      num: 'M1234567',
      expires: '2031-08-19',
    });
    expect(res.body.issued).toBeNull(); // malformed date rejected
    expect(res.body.notes.length).toBeLessThanOrEqual(500);
  });

  it('strips markdown fences from model output', async () => {
    const handler = await authedHandler(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"name":"PAN Card"}\n```' } }],
      }),
    }));
    const res = mockRes();
    await handler(
      mockReq({ headers: authHeaders, body: { dataUrl: TINY_PNG } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('PAN Card');
  });

  it('maps Groq failures to 502 without leaking details', async () => {
    const handler = await authedHandler(async () => ({ ok: false, status: 429 }));
    const res = mockRes();
    await handler(
      mockReq({ headers: authHeaders, body: { dataUrl: TINY_PNG } }),
      res,
    );
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('GROQ_ERROR');
  });
});
