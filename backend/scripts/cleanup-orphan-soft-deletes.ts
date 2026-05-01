/* eslint-disable no-console */
//
// One-time backfill: when a member was previously soft-deleted without
// cascading, related rows remained with deletedAt = NULL and kept polluting
// report queries. This script walks every soft-deleted member and stamps the
// member's own deletedAt onto any related row that is still live, so the
// historical data matches the new cascade logic in deleteMember().
//
// Idempotent — a second run finds nothing to update because we only target
// rows that still have deletedAt IS NULL.
//
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PerMemberCounts {
  subscriptions: number;
  attendanceRecords: number;
  payments: number;
  memberDisciplines: number;
  memberEquipment: number;
  familyLinks: number;
  documents: number;
  memberContacts: number;
  memberNotes: number;
  schedules: number;
}

function emptyCounts(): PerMemberCounts {
  return {
    subscriptions: 0,
    attendanceRecords: 0,
    payments: 0,
    memberDisciplines: 0,
    memberEquipment: 0,
    familyLinks: 0,
    documents: 0,
    memberContacts: 0,
    memberNotes: 0,
    schedules: 0,
  };
}

function totalOf(c: PerMemberCounts): number {
  return (
    c.subscriptions +
    c.attendanceRecords +
    c.payments +
    c.memberDisciplines +
    c.memberEquipment +
    c.familyLinks +
    c.documents +
    c.memberContacts +
    c.memberNotes +
    c.schedules
  );
}

async function main() {
  console.log('Scanning for soft-deleted members with live related rows...');

  const deletedMembers = await prisma.member.findMany({
    where: { deletedAt: { not: null } },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      deletedAt: true,
    },
    orderBy: { deletedAt: 'asc' },
  });

  console.log(`Found ${deletedMembers.length} soft-deleted member(s).`);

  const overall = emptyCounts();
  let touchedMembers = 0;

  for (const m of deletedMembers) {
    const deletedAt = m.deletedAt!;
    const name =
      [m.firstNameLatin, m.lastNameLatin].filter(Boolean).join(' ') || m.id;
    const notDeleted = { memberId: m.id, deletedAt: null };

    const c = emptyCounts();

    await prisma.$transaction(async (tx) => {
      c.subscriptions = (
        await tx.subscription.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.attendanceRecords = (
        await tx.attendanceRecord.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.payments = (
        await tx.payment.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.memberDisciplines = (
        await tx.memberDiscipline.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.memberEquipment = (
        await tx.memberEquipment.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.familyLinks = (
        await tx.familyLink.updateMany({
          where: {
            deletedAt: null,
            OR: [{ memberId: m.id }, { relatedMemberId: m.id }],
          },
          data: { deletedAt },
        })
      ).count;

      c.documents = (
        await tx.document.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.memberContacts = (
        await tx.memberContact.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.memberNotes = (
        await tx.memberNote.updateMany({
          where: notDeleted,
          data: { deletedAt },
        })
      ).count;

      c.schedules = (
        await tx.schedule.updateMany({
          where: {
            deletedAt: null,
            memberDiscipline: { memberId: m.id },
          },
          data: { deletedAt },
        })
      ).count;
    });

    const total = totalOf(c);
    if (total > 0) {
      touchedMembers += 1;
      console.log(`- ${name} (${m.id}) — ${total} row(s):`, c);
      for (const key of Object.keys(c) as (keyof PerMemberCounts)[]) {
        overall[key] += c[key];
      }
    }
  }

  console.log('');
  console.log(
    `Done. Updated ${touchedMembers} of ${deletedMembers.length} deleted member(s).`,
  );
  console.log('Totals:', overall);
  console.log(`Grand total rows updated: ${totalOf(overall)}`);
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
