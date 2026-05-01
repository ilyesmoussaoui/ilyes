import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Absolute day boundaries in the server's local timezone. We use UTC-based
 * offsets so a single `new Date()` comparison is deterministic regardless of
 * client locale.
 */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns the Setting for a given notification type (enabled flag, daysBefore,
 * template). When no row exists the type is treated as "enabled with default
 * daysBefore=7" — these are surfaced anyway so the UI isn't silent on
 * misconfiguration.
 */
async function getSetting(type: string): Promise<{
  isEnabled: boolean;
  daysBefore: number;
  template: string | null;
}> {
  const row = await prisma.notificationSetting.findFirst({
    where: { type: type as Prisma.EnumNotificationTypeFilter['equals'] },
  });
  return {
    isEnabled: row?.isEnabled ?? true,
    daysBefore: row?.daysBefore ?? 7,
    template: row?.template ?? null,
  };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function memberLabel(m: { firstNameLatin?: string | null; lastNameLatin?: string | null }): string {
  const full = `${m.firstNameLatin ?? ''} ${m.lastNameLatin ?? ''}`.trim();
  return full || 'Member';
}

function applyTemplate(template: string | null, fallback: string, vars: Record<string, string>): string {
  if (!template) return fallback;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * Only raise a given notification once per (member × type) within the last
 * `windowDays` — prevents the daily cron from flooding the bell every morning.
 */
async function hasRecentNotification(
  memberId: string,
  type: string,
  windowDays = 7,
): Promise<boolean> {
  const since = daysFromNow(-windowDays);
  const existing = await prisma.notification.findFirst({
    where: {
      memberId,
      type: type as Prisma.EnumNotificationTypeFilter['equals'],
      createdAt: { gte: since },
      deletedAt: null,
    },
    select: { id: true },
  });
  return !!existing;
}

// ─── Generators ──────────────────────────────────────────────────────────────

export async function generateSubscriptionExpiring(): Promise<number> {
  const setting = await getSetting('subscription_expiring');
  if (!setting.isEnabled) return 0;

  const targetDate = daysFromNow(setting.daysBefore);
  const today = daysFromNow(0);

  const subs = await prisma.subscription.findMany({
    where: {
      status: 'active',
      deletedAt: null,
      endDate: { gte: today, lte: targetDate },
    },
    include: {
      member: {
        select: { id: true, firstNameLatin: true, lastNameLatin: true },
      },
      discipline: { select: { name: true } },
    },
  });

  let created = 0;
  for (const sub of subs) {
    if (await hasRecentNotification(sub.memberId, 'subscription_expiring', setting.daysBefore)) {
      continue;
    }
    const name = memberLabel(sub.member);
    const endStr = fmtDate(sub.endDate);
    const message = applyTemplate(
      setting.template,
      `${name}'s ${sub.discipline.name} subscription expires on ${endStr}.`,
      { member: name, discipline: sub.discipline.name, date: endStr },
    );
    await prisma.notification.create({
      data: { type: 'subscription_expiring', memberId: sub.memberId, message },
    });
    created++;
  }
  return created;
}

export async function generateDocumentExpiring(): Promise<number> {
  const setting = await getSetting('document_expiring');
  if (!setting.isEnabled) return 0;

  const targetDate = daysFromNow(setting.daysBefore);
  const today = daysFromNow(0);

  const docs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      expiryDate: { gte: today, lte: targetDate },
    },
    include: {
      member: { select: { id: true, firstNameLatin: true, lastNameLatin: true } },
    },
  });

  let created = 0;
  for (const doc of docs) {
    if (await hasRecentNotification(doc.memberId, 'document_expiring', setting.daysBefore)) {
      continue;
    }
    const name = memberLabel(doc.member);
    const endStr = doc.expiryDate ? fmtDate(doc.expiryDate) : 'soon';
    const message = applyTemplate(
      setting.template,
      `${name}'s ${doc.type.replace(/_/g, ' ')} expires on ${endStr}.`,
      { member: name, type: doc.type, date: endStr },
    );
    await prisma.notification.create({
      data: { type: 'document_expiring', memberId: doc.memberId, message },
    });
    created++;
  }
  return created;
}

export async function generatePaymentDue(): Promise<number> {
  const setting = await getSetting('payment_due');
  if (!setting.isEnabled) return 0;

  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      remaining: { gt: 0 },
    },
    include: {
      member: { select: { id: true, firstNameLatin: true, lastNameLatin: true } },
    },
  });

  let created = 0;
  for (const p of payments) {
    if (await hasRecentNotification(p.memberId, 'payment_due', 7)) continue;
    const name = memberLabel(p.member);
    const remainingDzd = (p.remaining / 100).toLocaleString();
    const message = applyTemplate(
      setting.template,
      `${name} has an unpaid balance of ${remainingDzd} DZD (receipt ${p.receiptNumber}).`,
      { member: name, amount: remainingDzd, receipt: p.receiptNumber },
    );
    await prisma.notification.create({
      data: { type: 'payment_due', memberId: p.memberId, message },
    });
    created++;
  }
  return created;
}

export async function generateBirthdays(): Promise<number> {
  const setting = await getSetting('birthday');
  if (!setting.isEnabled) return 0;

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Use raw SQL for month/day match — Prisma can't compare date-parts natively.
  const members = await prisma.$queryRaw<Array<{
    id: string;
    first_name_latin: string | null;
    last_name_latin: string | null;
  }>>`
    SELECT id, first_name_latin, last_name_latin
    FROM members
    WHERE deleted_at IS NULL
      AND date_of_birth IS NOT NULL
      AND EXTRACT(MONTH FROM date_of_birth) = ${month}
      AND EXTRACT(DAY FROM date_of_birth) = ${day}
  `;

  let created = 0;
  for (const m of members) {
    if (await hasRecentNotification(m.id, 'birthday', 1)) continue;
    const name = memberLabel({
      firstNameLatin: m.first_name_latin,
      lastNameLatin: m.last_name_latin,
    });
    const message = applyTemplate(
      setting.template,
      `Today is ${name}'s birthday — wish them well!`,
      { member: name },
    );
    await prisma.notification.create({
      data: { type: 'birthday', memberId: m.id, message },
    });
    created++;
  }
  return created;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export interface GenerationSummary {
  subscription_expiring: number;
  document_expiring: number;
  payment_due: number;
  birthday: number;
  total: number;
}

export async function generateAllNotifications(): Promise<GenerationSummary> {
  const [subs, docs, pays, bdays] = await Promise.all([
    generateSubscriptionExpiring(),
    generateDocumentExpiring(),
    generatePaymentDue(),
    generateBirthdays(),
  ]);
  return {
    subscription_expiring: subs,
    document_expiring: docs,
    payment_due: pays,
    birthday: bdays,
    total: subs + docs + pays + bdays,
  };
}
