/**
 * On-device document scanning using Tesseract.js OCR.
 *
 * The image never leaves the device — no third-party API call.
 * Tesseract.js runs WASM in the browser. The extracted text is parsed
 * with simple heuristics to find document fields.
 */

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng'));
  }
  return workerPromise;
}

/**
 * Scan a document image on-device using Tesseract.js OCR.
 * @param {File|Blob} image
 * @returns {Promise<{ ok: boolean, name?: string, num?: string, by?: string, issued?: string, expires?: string, notes?: string, error?: string }>}
 */
export async function scanOnDevice(image) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    const text = data.text || '';
    return parseDocumentText(text);
  } catch (e) {
    return { ok: false, error: e?.message || 'On-device scan failed' };
  }
}

/**
 * Parse OCR text into document fields using simple heuristics.
 */
function parseDocumentText(text) {
  const result = { ok: true, name: '', num: '', by: '', issued: '', expires: '', notes: '' };
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // Document type
  if (fullText.includes('aadhaar') || fullText.includes('aadhar') || fullText.includes('uidai')) {
    result.name = 'Aadhar Card';
    result.by = 'UIDAI, India';
  } else if (fullText.includes('pan card') || fullText.includes('permanent account')) {
    result.name = 'PAN Card';
    result.by = 'Income Tax Dept.';
  } else if (fullText.includes('passport')) {
    result.name = 'Passport';
    result.by = 'Min. of External Affairs';
  } else if (fullText.includes('driving licence') || fullText.includes('driver license')) {
    result.name = "Driver's License";
  } else if (fullText.includes('voter id') || fullText.includes('epic')) {
    result.name = 'Voter ID (EPIC)';
    result.by = 'Election Commission of India';
  } else {
    result.name = 'Document';
  }

  // Document number — look for common patterns
  const numPatterns = [
    /\b\d{4}\s\d{4}\s\d{4}\b/,           // Aadhaar: 1234 5678 9012
    /\b[A-Z]{5}\d{4}[A-Z]\b/,            // PAN: ABCDE1234F
    /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}\b/, // Passport: M1234567
    /\b[A-Z0-9]{8,14}\b/,                // Generic
  ];
  for (const pattern of numPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.num = match[0];
      break;
    }
  }

  // Dates — look for DD/MM/YYYY or DD-MM-YYYY
  const datePattern = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/g;
  const dates = [];
  let match;
  while ((match = datePattern.exec(text)) !== null) {
    dates.push(match[1]);
  }
  if (dates.length >= 1) result.issued = dates[0];
  if (dates.length >= 2) result.expires = dates[1];

  // Issuer — look for common keywords
  const issuerKeywords = ['uidai', 'income tax', 'ministry', 'government', 'rto', 'municipal', 'hospital', 'bank', 'insurance'];
  for (const keyword of issuerKeywords) {
    if (fullText.includes(keyword)) {
      const line = lines.find((l) => l.toLowerCase().includes(keyword));
      if (line) result.by = line;
      break;
    }
  }

  return result;
}
