# DigiLocker Integration Assessment

**Date:** 2026-09-29
**Status:** Assessment only — not implemented (requires DigiLocker program registration)

## What is DigiLocker?

DigiLocker is the Indian government's digital document platform (under MeitY). It provides verified digital copies of documents (Aadhaar, PAN, driving licence, mark sheets, etc.) issued by government agencies. Users can access, share, and verify documents from their DigiLocker account.

## Integration options

### Option A: DigiLocker API integration (full)
- Register as a DigiLocker partner (requires business verification, MeitY approval).
- Use the DigiLocker OAuth + document API to pull verified documents directly into VaultID.
- **Pros:** Documents are pre-verified by the issuer; no scanning needed.
- **Cons:** Requires government partnership, lengthy approval, ongoing compliance.
- **Effort:** L (months, not weeks — depends on approval).

### Option B: Aadhaar eKYC / DigiLocker QR (lightweight)
- Use the DigiLocker QR code on physical documents to verify authenticity.
- Scan the QR with VaultID to confirm the document is genuine.
- **Pros:** No partnership required; uses the QR already on most documents.
- **Cons:** Only verifies, doesn't import the document.
- **Effort:** S (QR parsing + verification API call).

### Option C: Manual import with verification (pragmatic)
- User uploads a photo of their DigiLocker document.
- VaultID extracts the fields (via Groq or on-device OCR).
- User manually confirms the document is from DigiLocker.
- **Pros:** No partnership, works today.
- **Cons:** Not automated; user must manually verify.
- **Effort:** S (UI for "import from DigiLocker" with a verification checkbox).

## Recommendation

**Option C now, Option B later.** Option C is a UI addition that works immediately. Option B (QR verification) is a good follow-up that adds real value (authenticity verification) without a government partnership. Option A is a strategic decision for the business, not a technical one.

## India-specific angle (beyond DigiLocker)

Already implemented:
- Aadhaar validation (Verhoeff checksum) — `src/utils/documentValidation.js`
- PAN validation (ABCDE1234F format) — `src/utils/documentValidation.js`
- Demo data uses Indian documents (Aadhaar, PAN, EPF, Voter ID, etc.)

Not yet implemented:
- **Aadhaar masking rules** — UIDAI requires Aadhaar numbers to be masked (show only last 4 digits) in most contexts. The demo data already masks (`XXXX XXXX 4521`), but the app should enforce masking in the UI.
- **DigiLocker QR verification** — scan the QR on a DigiLocker document to verify authenticity.
- **PAN checksum** — PAN has a checksum character (the 10th character). The current validation only checks the format, not the checksum.

## PAN checksum

The 10th character of a PAN is a checksum. The algorithm:
1. Take the first 9 characters.
2. For letters (positions 1-5, 10), convert to a number (A=10, B=11, ..., Z=35).
3. For digits (positions 6-9), use the digit value.
4. Compute the checksum using a weighted sum mod 36.
5. The result should match the 10th character.

This is a small addition to `validatePAN` and would make the validation complete.
