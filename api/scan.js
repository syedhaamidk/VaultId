/**
 * VaultID — /api/scan
 *
 * Server-side proxy for Groq vision. The API key is read only here and is
 * never bundled into the client. The endpoint requires a valid Supabase
 * session token (sent by the client) so only signed-in users can scan.
 *
 * Rate limiting uses a shared in-memory store with a TTL. For production
 * with multiple serverless instances, replace with Redis or a Supabase
 * table.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Verify this model exists at https://console.groq.com/docs/models
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
const MAX_IMAGE_BYTES = 2_500_000;
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 128;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

// ── Supabase auth ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

async function verifySupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Rate limiting (shared in-memory with TTL) ────────────────────────────────
const rateBuckets = new Map();

function isRateLimited(clientKey) {
  const now = Date.now();
  const current = rateBuckets.get(clientKey);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(clientKey, { startedAt: now, count: 1 });
    return false;
  }

  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;

  // Opportunistically remove old buckets.
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets) {
      if (now - v.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return false;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function requestHeaders(req) {
  return req?.headers || {};
}

function isAllowedOrigin(req) {
  const headers = requestHeaders(req);
  const origin = headers.origin;
  if (!origin) return false; // require Origin header
  const configured = (process.env.APP_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (configured.includes(origin.replace(/\/$/, ''))) return true;
  try {
    const host = headers['x-forwarded-host'] || headers.host;
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = requestHeaders(req).origin;
  res.setHeader('Vary', 'Origin');
  if (origin && isAllowedOrigin(req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return JSON.parse(body.toString());
  return body;
}

function imageSizeFromDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const payload = match[2];
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return {
    mimeType: match[1],
    bytes: Math.floor((payload.length * 3) / 4) - padding,
  };
}

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Round-trip through a real calendar so 2021-13-45 or 2023-02-30 fail.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return value;
}

function sanitizeResult(result) {
  const categories = new Set(['identity', 'medical', 'financial', 'property', 'legal']);
  const category = typeof result?.category === 'string' ? result.category.toLowerCase() : '';
  return {
    name: cleanText(result?.name, 120),
    category: categories.has(category) ? category : 'identity',
    num: cleanText(result?.num, 160),
    by: cleanText(result?.by, 160),
    issued: cleanDate(result?.issued),
    expires: cleanDate(result?.expires),
    notes: cleanText(result?.notes, 500),
  };
}

const PROMPT = `You are a document data extractor. Carefully read this document image and extract the key fields.
Return ONLY a valid JSON object with no markdown fences, explanation, or extra text:
{
  "name": "document type in English (e.g. Aadhar Card, PAN Card, Passport, Driver's License, Health Insurance)",
  "category": "one of: identity | medical | financial | property | legal",
  "num": "the primary document number, ID number, or policy number",
  "by": "the issuing authority or organization",
  "issued": "issue date in YYYY-MM-DD format, or null if not visible",
  "expires": "expiry date in YYYY-MM-DD format, or null if the document doesn't expire",
  "notes": "any other important details in one short sentence (blood group, sum insured, UAN, etc.), or empty string"
}`;

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed.' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });

  // ── Authentication ──────────────────────────────────────────────────────
  const authHeader = requestHeaders(req).authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'A valid session token is required.' });
  }
  const isValid = await verifySupabaseToken(token);
  if (!isValid) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session.' });
  }

  // ── Rate limiting ───────────────────────────────────────────────────────
  const forwarded = requestHeaders(req)['x-forwarded-for'];
  const clientKey = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) || 'unknown';
  if (isRateLimited(clientKey)) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many scan requests. Try again later.' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'NO_SERVER_KEY', message: 'GROQ_API_KEY is not set on the server.' });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid JSON body.' });
  }

  const dataUrl = body?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing dataUrl.' });
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'Image is too large.' });
  }

  const image = imageSizeFromDataUrl(dataUrl);
  if (!image) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Expected a base64 PNG, JPG, or WEBP image.' });
  }
  if (image.bytes > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'Image is too large.' });
  }
  if (body.mimeType && body.mimeType !== image.mimeType && !(body.mimeType === 'image/jpg' && image.mimeType === 'image/jpeg')) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'MIME type does not match the image.' });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: 600,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!groqRes.ok) {
      return res.status(502).json({ error: 'GROQ_ERROR', message: 'The document scanner is temporarily unavailable.' });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    return res.status(200).json(sanitizeResult(parsed));
  } catch {
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'The document could not be scanned.' });
  }
}
