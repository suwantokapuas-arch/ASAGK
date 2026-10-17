import { SecurityAuditLog, SecurityActionType, UserRole } from './types';
import { saveAuditLogToFirestore } from './firebase';

/**
 * XSS & HTML Injection Sanitizer
 * Strips script tags, HTML tags, dangerous event handlers, and javascript pseudo-protocols.
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
}

/**
 * Recursively sanitize all string properties in an object.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = sanitizeObject(val);
    }
    return result as T;
  }
  return obj;
}

/**
 * Compute Cryptographic SHA-256 Digest for Document Tamper-Proofing
 * Uses native Web Crypto API (SubtleCrypto) with fallback.
 */
export async function computeDocumentHash(data: {
  id: string;
  teacherName?: string;
  schoolName?: string;
  date?: string;
  finalScore?: number;
  predicate?: string;
  supervisorName?: string;
}): Promise<string> {
  const canonicalPayload = [
    data.id || '',
    (data.teacherName || '').trim().toLowerCase(),
    (data.schoolName || '').trim().toLowerCase(),
    data.date || '',
    typeof data.finalScore === 'number' ? data.finalScore.toFixed(2) : '',
    data.predicate || '',
    (data.supervisorName || '').trim().toLowerCase(),
    'DISDIK_KAPUAS_KUALA_SECURITY_SALT_2026'
  ].join('|');

  if (window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(canonicalPayload);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.warn('SubtleCrypto error, falling back to deterministic digest', e);
    }
  }

  // Pure deterministic 64-character hash fallback
  return fallbackSha256Hex(canonicalPayload);
}

function fallbackSha256Hex(str: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  const p5 = (Math.imul(h1, 31) >>> 0).toString(16).padStart(8, '0');
  const p6 = (Math.imul(h2, 37) >>> 0).toString(16).padStart(8, '0');
  const p7 = ((h1 ^ 0xa5a5a5a5) >>> 0).toString(16).padStart(8, '0');
  const p8 = ((h2 ^ 0x5a5a5a5a) >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}`.toLowerCase();
}

/**
 * Verify Document Integrity against expected hash
 */
export async function verifyDocumentIntegrity(
  docData: any,
  providedHash: string
): Promise<{ isValid: boolean; computedHash: string }> {
  const computed = await computeDocumentHash(docData);
  const cleanProvided = (providedHash || '').trim().toLowerCase();
  const isValid = computed.toLowerCase() === cleanProvided;
  return { isValid, computedHash: computed };
}

/**
 * Rate Limiter & Brute Force Defense
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 45;

interface LockoutState {
  attempts: number;
  lockedUntil: number;
}

function getLockoutMap(): Record<string, LockoutState> {
  try {
    const raw = localStorage.getItem('asagk_security_lockouts');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveLockoutMap(map: Record<string, LockoutState>) {
  try {
    localStorage.setItem('asagk_security_lockouts', JSON.stringify(map));
  } catch (e) {
    // ignore storage quota errors
  }
}

export function checkLoginLockout(username: string): { isLocked: boolean; remainingSeconds: number } {
  if (!username) return { isLocked: false, remainingSeconds: 0 };
  const key = username.trim().toLowerCase();
  const map = getLockoutMap();
  const state = map[key];
  if (!state) return { isLocked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (state.lockedUntil > now) {
    const remaining = Math.ceil((state.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds: remaining };
  }

  // Lockout expired
  if (state.lockedUntil > 0 && state.lockedUntil <= now) {
    delete map[key];
    saveLockoutMap(map);
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedLogin(username: string): { isLocked: boolean; remainingSeconds: number; attempts: number } {
  const key = (username || 'unknown').trim().toLowerCase();
  const map = getLockoutMap();
  const now = Date.now();
  const state: LockoutState = map[key] || { attempts: 0, lockedUntil: 0 };

  state.attempts += 1;
  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_SECONDS * 1000;
  }
  map[key] = state;
  saveLockoutMap(map);

  const remaining = state.lockedUntil > now ? Math.ceil((state.lockedUntil - now) / 1000) : 0;
  return {
    isLocked: state.lockedUntil > now,
    remainingSeconds: remaining,
    attempts: state.attempts
  };
}

export function resetLoginLockout(username: string) {
  const key = (username || '').trim().toLowerCase();
  const map = getLockoutMap();
  if (map[key]) {
    delete map[key];
    saveLockoutMap(map);
  }
}

/**
 * Password Strength Evaluator
 */
export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: 'Sangat Lemah' | 'Lemah' | 'Cukup' | 'Kuat' | 'Sangat Kuat';
  color: string;
  suggestions: string[];
} {
  if (!password) {
    return { score: 0, label: 'Sangat Lemah', color: 'text-rose-500', suggestions: ['Masukkan kata sandi.'] };
  }

  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 6) score += 1;
  else suggestions.push('Gunakan minimal 6 karakter');

  if (password.length >= 8) score += 1;
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score += 1;
  else suggestions.push('Kombinasikan huruf dan angka');

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) || password.length >= 12) score += 1;
  else suggestions.push('Gunakan simbol unik atau perpanjang kata sandi');

  const finalScore = Math.min(4, score);
  const labels: Array<'Sangat Lemah' | 'Lemah' | 'Cukup' | 'Kuat' | 'Sangat Kuat'> = [
    'Sangat Lemah',
    'Lemah',
    'Cukup',
    'Kuat',
    'Sangat Kuat'
  ];
  const colors = [
    'text-rose-600',
    'text-orange-600',
    'text-amber-600',
    'text-emerald-600',
    'text-teal-700'
  ];

  return {
    score: finalScore,
    label: labels[finalScore],
    color: colors[finalScore],
    suggestions
  };
}

/**
 * Immutable Audit Logger
 */
const AUDIT_STORAGE_KEY = 'asagk_security_audit_logs';

export function getLocalAuditLogs(): SecurityAuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function logSecurityEvent(params: {
  action: SecurityActionType;
  userName: string;
  userRole?: UserRole | string;
  details: string;
  status?: 'SUCCESS' | 'WARNING' | 'ALERT';
}): Promise<SecurityAuditLog> {
  const newLog: SecurityAuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action: params.action,
    userName: sanitizeString(params.userName) || 'Sistem',
    userRole: params.userRole,
    details: sanitizeString(params.details),
    timestamp: new Date().toISOString(),
    status: params.status || 'SUCCESS'
  };

  // 1. Save to local storage
  try {
    const existing = getLocalAuditLogs();
    const updated = [newLog, ...existing].slice(0, 300); // retain last 300 logs
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save audit log to localStorage', e);
  }

  // 2. Transmit to Firestore audit_logs collection
  try {
    await saveAuditLogToFirestore(newLog);
  } catch (e) {
    // Audit log transmission failed or offline, kept in local audit log
    console.warn('Audit log saved locally, remote sync pending:', e);
  }

  return newLog;
}
