/**
 * VaultID — /api/scan
 *
 * Server-side proxy for the Groq vision call. The Groq API key lives ONLY
 * here (as the non-VITE_-prefixed env var GROQ_API_KEY), so it's never
 * bundled into client JS and never visible via devtools/network tab.
 *
 * The client sends the document image; this function forwards it to Groq
 * with the server-held key and returns the parsed extraction result.
 *
 * Deploy target: Vercel (Node serverless function). If you deploy elsewhere,
 * port this same logic to that platform's serverless/edge function format —
 * the important part is just "key lives server-side, client never sees it".
 */

const GROQ_URL          = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

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

export default async function handler(req, res) {
  // Basic CORS / method guard — same-origin calls from the app itself.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'NO_SERVER_KEY', message: 'GROQ_API_KEY is not set on the server. Add it in your Vercel project env vars (not VITE_-prefixed).' });
  }

  const { dataUrl, mimeType } = req.body || {};
  if (!dataUrl) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing dataUrl' });

  // Lightweight server-side guard against abuse: reject anything obviously
  // not an image data URL or absurdly large (base64 inflates ~33%).
  if (!dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Expected an image data URL' });
  }
  if (dataUrl.length > 6_000_000) {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'Image too large' });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:           GROQ_VISION_MODEL,
        max_tokens:      600,
        temperature:     0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({ error: 'GROQ_ERROR', message: err?.error?.message ?? `Groq error ${groqRes.status}` });
    }

    const data    = await groqRes.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed  = JSON.parse(content.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
}
