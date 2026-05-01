/**
 * Offline-aware wrappers around the online API.
 *
 * Usage pattern: try the normal `api.*` call first (via the caller).
 * On `NETWORK_ERROR` (or when `navigator.onLine === false`), invoke the
 * corresponding `queueXxx(...)` helper below to persist the mutation for later
 * replay. These helpers are deliberately thin: business logic stays in the
 * feature modules.
 */

import { enqueueMutation } from './queue';

export async function queueAttendanceCheckIn(body: {
  memberId: string;
  memberLabel: string;
  disciplineId?: string;
  method: 'face' | 'manual' | 'barcode';
  device?: string;
  notes?: string;
}): Promise<void> {
  await enqueueMutation({
    kind: 'attendance.checkin',
    path: '/attendance/checkin',
    method: 'POST',
    body: {
      memberId: body.memberId,
      disciplineId: body.disciplineId,
      method: body.method,
      device: body.device,
      notes: body.notes,
    },
    label: `Check-in: ${body.memberLabel}`,
  });
}

export async function queueAttendanceCheckOut(body: {
  attendanceId: string;
  memberLabel: string;
}): Promise<void> {
  await enqueueMutation({
    kind: 'attendance.checkout',
    path: `/attendance/${body.attendanceId}/checkout`,
    method: 'POST',
    body: {},
    label: `Check-out: ${body.memberLabel}`,
  });
}

export async function queuePosCheckout(body: {
  memberId: string | null;
  memberLabel: string;
  items: Array<{
    productId: string | null;
    description: string;
    unitPrice: number;
    quantity: number;
  }>;
  paymentType: 'full' | 'partial';
  paidAmount: number;
  notes?: string;
}): Promise<void> {
  await enqueueMutation({
    kind: 'pos.checkout',
    path: '/pos/checkout',
    method: 'POST',
    body: {
      memberId: body.memberId,
      items: body.items,
      paymentType: body.paymentType,
      paidAmount: body.paidAmount,
      notes: body.notes,
    },
    label: `POS sale: ${body.memberLabel}`,
  });
}

export async function queueMemberUpdate(body: {
  memberId: string;
  memberLabel: string;
  patch: Record<string, unknown>;
}): Promise<void> {
  await enqueueMutation({
    kind: 'member.update',
    path: `/members/${body.memberId}`,
    method: 'PATCH',
    body: body.patch,
    label: `Update member: ${body.memberLabel}`,
  });
}
