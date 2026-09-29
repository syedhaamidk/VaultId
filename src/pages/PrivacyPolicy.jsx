import { ShieldCheck, Lock, Eye, Server, Trash2 } from 'lucide-react';

/**
 * Privacy policy page — explains the zero-knowledge architecture in
 * plain language.
 */
export default function PrivacyPolicy({ onBack }) {
  return (
    <div className="site" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>
        <button className="abtn abg" onClick={onBack} style={{ marginBottom: 32 }}>
          ← Back
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--tx3)', fontSize: 13, marginBottom: 40 }}>
          Last updated: September 2026
        </p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} style={{ color: 'var(--ac1)' }} />
            Zero-Knowledge by Design
          </h2>
          <p style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14 }}>
            Your documents are encrypted <strong>on your device</strong> with AES-256-GCM
            before they are stored or synced. We never see your plaintext — only
            encrypted bytes. Your decryption key is derived from your PIN or
            passphrase and never leaves your device.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={20} style={{ color: 'var(--ac1)' }} />
            What We Store
          </h2>
          <ul style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14, paddingLeft: 20 }}>
            <li><strong>On your device:</strong> Your encrypted vault (documents, images, emergency details) in browser local storage.</li>
            <li><strong>On our servers (optional sync):</strong> Only the encrypted blob — <code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: 4 }}>{'{ iv, salt, ciphertext }'}</code>. We cannot decrypt it.</li>
            <li><strong>Never:</strong> Your PIN, passphrase, or plaintext documents.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={20} style={{ color: 'var(--ac1)' }} />
            AI Document Scanning
          </h2>
          <p style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14 }}>
            When you scan a document, you have two options:
          </p>
          <ul style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14, paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Scan on-device (recommended):</strong> Your image is processed locally in your browser using Tesseract.js OCR. The image never leaves your device.</li>
            <li><strong>Scan with Groq AI:</strong> Your image is sent to Groq's servers for processing. Groq processes the image to extract document fields but does not store it long-term.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={20} style={{ color: 'var(--ac1)' }} />
            What We Never Do
          </h2>
          <ul style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14, paddingLeft: 20 }}>
            <li>We never see your plaintext documents, images, or emergency details.</li>
            <li>We never see your PIN or passphrase.</li>
            <li>We never sell or share your data with third parties.</li>
            <li>We never access your vault — we technically cannot.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={20} style={{ color: 'var(--ac1)' }} />
            Your Control
          </h2>
          <p style={{ color: 'var(--tx2)', lineHeight: 1.7, fontSize: 14 }}>
            You can export your encrypted vault at any time (Settings → Export).
            You can delete your vault and all associated data by clearing your
            browser's local storage. If you use optional cloud sync, you can
            delete your account and all server-side data at any time.
          </p>
        </section>

        <p style={{ color: 'var(--tx3)', fontSize: 12, marginTop: 40, textAlign: 'center' }}>
          Questions? Contact us — your data stays yours.
        </p>
      </div>
    </div>
  );
}
