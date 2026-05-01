import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import { getSmsProvider, type SmsMessage } from './sms.provider.js';

// In-memory per-member daily counter. Resets at UTC midnight.
// For multi-instance deployments a Redis counter would be preferable,
// but this single-process SaaS uses in-memory until scaled out.
interface DayCounter {
  day: string;
  count: number;
}

const dailyCounts = new Map<string, DayCounter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function incrementAndCheck(memberId: string): boolean {
  const env = getEnv();
  const today = todayKey();
  const existing = dailyCounts.get(memberId);
  if (!existing || existing.day !== today) {
    dailyCounts.set(memberId, { day: today, count: 1 });
    return true;
  }
  if (existing.count >= env.SMS_DAILY_PER_MEMBER_CAP) return false;
  existing.count += 1;
  return true;
}

// ─── Text sanitiser — prevent accidental injection from user data ───────────

function sanitize(text: string, maxLen = 480): string {
  // Strip ASCII control chars except newline; cap length.
  // SMS templates should never contain raw HTML but this also defends against
  // a future email/webhook reuse of the same helper.
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[<>]/g, '');
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
}

// ─── Phone normalisation ────────────────────────────────────────────────────

function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip whitespace, dashes, dots and parentheses.
  const stripped = trimmed.replace(/[\s()\-\.]/g, '');
  if (!/^\+?\d{6,15}$/.test(stripped)) return null;

  // Convert Algerian national format (0XXXXXXXXX, 10 digits) to E.164 (+213XXXXXXXXX).
  // Algerian mobile/landline numbers written locally as 0x xx xx xx xx
  // become +213 x xx xx xx xx in international format.
  if (/^0[5-9]\d{8}$/.test(stripped)) {
    // Mobile: 05/06/07 prefix (10 digits starting with 0)
    return '+213' + stripped.slice(1);
  }
  if (/^0[1-4]\d{8}$/.test(stripped)) {
    // Landline: 021/031/… prefix (10 digits starting with 0)
    return '+213' + stripped.slice(1);
  }

  // Already E.164 or another country code — return as-is.
  return stripped.startsWith('+') ? stripped : '+' + stripped;
}

// ─── Enqueue + retry ────────────────────────────────────────────────────────

export interface EnqueueArgs {
  memberId: string | null; // null for parent notifications where we still meter per child
  to: string;
  body: string;
  reason: string; // for logging/audit
}

export function enqueueSms(args: EnqueueArgs): void {
  const phone = normalisePhone(args.to);
  if (!phone) return;
  const body = sanitize(args.body);
  if (args.memberId && !incrementAndCheck(args.memberId)) {
    // rate-limited — drop silently
    return;
  }
  const msg: SmsMessage = { to: phone, body };
  // Fire-and-forget with bounded retries. Do NOT await on the caller's hot path.
  setImmediate(() => {
    void sendWithRetry(msg, args.reason, args.memberId);
  });
}

async function sendWithRetry(msg: SmsMessage, reason: string, memberId: string | null): Promise<void> {
  const provider = getSmsProvider();
  const MAX_ATTEMPTS = 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await provider.send(msg);
      await auditSms({
        memberId,
        to: msg.to,
        reason,
        status: 'sent',
        provider: provider.name,
        attempt,
        error: null,
      });
      return;
    } catch (err) {
      lastErr = err as Error;
      // Exponential backoff: 250ms, 1s.
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
      }
    }
  }
  await auditSms({
    memberId,
    to: msg.to,
    reason,
    status: 'failed',
    provider: provider.name,
    attempt: MAX_ATTEMPTS,
    error: lastErr?.message ?? 'unknown',
  });
}

async function auditSms(entry: {
  memberId: string | null;
  to: string;
  reason: string;
  status: 'sent' | 'failed';
  provider: string;
  attempt: number;
  error: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: 'sms',
        recordId: '00000000-0000-0000-0000-000000000000',
        fieldName: `${entry.provider}:${entry.status}`,
        oldValue: null,
        newValue: JSON.stringify({
          memberId: entry.memberId,
          to: maskPhone(entry.to),
          reason: entry.reason,
          attempt: entry.attempt,
          error: entry.error?.slice(0, 300) ?? null,
        }),
        userId: null,
        reason: entry.reason.slice(0, 120),
      },
    });
  } catch {
    // audit is best-effort
  }
}

function maskPhone(p: string): string {
  if (p.length <= 4) return '***';
  return p.slice(0, 3) + '***' + p.slice(-2);
}
