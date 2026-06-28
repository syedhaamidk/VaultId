/**
 * VaultID — Data constants
 * Pure data — no React imports.
 */

export const TODAY    = new Date('2026-06-18');
export const DEMO_PIN = '1234';

// ── Document categories ──────────────────────────────────────────────────────
export const VAULT_CAT = {
  all:       { label: 'All Documents', color: '#7878A0' },
  identity:  { label: 'Identity',      color: '#7B6FE8' },
  medical:   { label: 'Medical',       color: '#10B981' },
  financial: { label: 'Financial',     color: '#F59E0B' },
  property:  { label: 'Property',      color: '#3B82F6' },
  legal:     { label: 'Legal',         color: '#8B5CF6' },
};

// ── Demo documents (used on first vault initialisation) ──────────────────────
export const DOCS0 = [
  { id:1,  name:'Aadhar Card',         cat:'identity',  num:'XXXX XXXX 4521',      by:'UIDAI, India',                  issued:'2015-06-10', expires:null,         notes:'Primary government ID' },
  { id:2,  name:'PAN Card',            cat:'identity',  num:'ABCDE1234F',           by:'Income Tax Dept.',             issued:'2018-03-20', expires:null,         notes:'Required for transactions ≥ ₹50k' },
  { id:3,  name:"Driver's License",    cat:'identity',  num:'KA01-2020-0045123',    by:'Karnataka RTO',                issued:'2020-03-15', expires:'2040-03-15', notes:'' },
  { id:4,  name:'Passport',            cat:'identity',  num:'M1234567',             by:'Min. of External Affairs',     issued:'2021-08-20', expires:'2031-08-19', notes:'36 pages' },
  { id:5,  name:'Health Insurance',    cat:'medical',   num:'STAR-HI-2026-890123',  by:'Star Health Insurance',        issued:'2026-01-01', expires:'2026-07-10', notes:'₹5 Lakhs sum insured' },
  { id:6,  name:'COVID Vaccination',   cat:'medical',   num:'COWIN-23901127',        by:'Ministry of Health',          issued:'2021-09-15', expires:null,         notes:'2 doses + booster (Mar 2022)' },
  { id:7,  name:'Blood Group Report',  cat:'medical',   num:'APL-2024-BLR-00123',   by:'Apollo Diagnostics, BLR',     issued:'2024-11-20', expires:null,         notes:'O+ · Rh: Positive' },
  { id:8,  name:'Voter ID (EPIC)',     cat:'identity',  num:'KA/24/152/345678',     by:'Election Commission of India', issued:'2020-01-10', expires:null,         notes:'' },
  { id:9,  name:'Ophthalmology Rx',    cat:'medical',   num:'RX-2026-01-14523',     by:'Manipal Hospital, BLR',       issued:'2026-01-14', expires:'2026-04-14', notes:'-0.75/-1.00 OD/OS' },
  { id:10, name:'EPF Account',         cat:'financial', num:'KA/1234/56789',         by:'EPFO, India',                 issued:'2022-06-01', expires:null,         notes:'UAN: 100000000000' },
  { id:11, name:'Rental Agreement',    cat:'property',  num:'BLR-RENT-2025-4521',   by:'Notary Public, Bengaluru',    issued:'2025-06-01', expires:'2026-05-31', notes:'1BHK Koramangala' },
];

// ── Emergency card ───────────────────────────────────────────────────────────
export const EM = {
  bloodType:   'O+',
  allergies:   ['Penicillin'],
  medications: ['None currently'],
  conditions:  ['Mild myopia (corrected)'],
  contact:     { name: 'Mom', phone: '+91 98765 43210' },
  donor:       true,
};

// ── CardNav items ────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  {
    label: 'Documents', bgColor: '#1A1A30', textColor: '#D0D0FF',
    links: [
      { label: 'Identity Cards',  href: '#' },
      { label: 'Medical Records', href: '#' },
      { label: 'Financial Docs',  href: '#' },
    ],
  },
  {
    label: 'Security', bgColor: '#1A0F28', textColor: '#E0D0FF',
    links: [
      { label: 'AES-256 Encryption', href: '#' },
      { label: 'Emergency Card',     href: '#' },
      { label: 'Zero-Knowledge',     href: '#' },
    ],
  },
  {
    label: 'Features', bgColor: '#0F1A28', textColor: '#C8E8FF',
    links: [
      { label: 'AI Document Scan',   href: '#' },
      { label: 'Expiry Tracking',    href: '#' },
      { label: 'QR Emergency Card',  href: '#' },
    ],
  },
];

// ── Landing page feature cards ────────────────────────────────────────────────
// iconName maps to lucide-react icons imported in LandingPage.jsx
export const FEATS = [
  {
    iconName: 'Shield',   title: 'AES-256-GCM',
    desc: 'Military-grade encryption with 100k PBKDF2 iterations. Your PIN is the only key — never transmitted.',
    col: '#7B6FE8', cols: ['#7B6FE8', '#9B8FF8', '#C5BFFF'], glow: '255 230 90',
  },
  {
    iconName: 'Sparkles', title: 'AI Document Scan',
    desc: 'Drop a PDF or photo. Claude extracts the document type, number, issuer, and expiry automatically.',
    col: '#C060F0', cols: ['#C060F0', '#D890FF', '#ECC8FF'], glow: '280 80 85',
  },
  {
    iconName: 'Zap',      title: 'Emergency Card + QR',
    desc: 'One-tap medical ID card with a scannable QR code. First responders get critical info instantly.',
    col: '#F87171', cols: ['#F87171', '#FFA0A0', '#FFCCCC'], glow: '0 90 80',
  },
  {
    iconName: 'Clock',    title: 'Smart Expiry Alerts',
    desc: 'Automatic warnings when your license, passport, or insurance is about to expire.',
    col: '#FBBF24', cols: ['#FBBF24', '#FFD060', '#FFE8A0'], glow: '45 100 80',
  },
  {
    iconName: 'Globe',    title: 'Cross-Device Sync',
    desc: 'Optional zero-knowledge Supabase sync. The server only ever stores AES ciphertext.',
    col: '#3B82F6', cols: ['#3B82F6', '#60A5FF', '#A0C8FF'], glow: '215 90 80',
  },
  {
    iconName: 'Lock',     title: 'Zero-Knowledge Arch',
    desc: 'Your decryption key is derived locally and lives only in session memory. Servers see nothing.',
    col: '#34D399', cols: ['#34D399', '#60EEB8', '#A0FFD8'], glow: '160 70 75',
  },
];
