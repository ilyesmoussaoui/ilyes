import { api } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface PaymentLineItem {
  description: string;
  amount: number; // in centimes
}

export type PaymentKind = 'full' | 'partial' | 'later' | 'refund' | 'adjustment';

export interface PaymentLineItemWithType extends PaymentLineItem {
  type?: 'subscription' | 'equipment' | 'fee' | 'registration' | 'other';
}

export interface CreatePaymentBody {
  memberId: string;
  items: PaymentLineItemWithType[];
  paymentType: 'full' | 'partial' | 'later';
  paidAmount: number; // in centimes
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  memberId: string;
  memberName: string;
  memberPhotoUrl: string | null;
  items: PaymentLineItem[];
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  paymentType: PaymentKind;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentsListResponse {
  payments: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentsListParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  paymentType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RefundResponse {
  payment: PaymentRecord;
  refund: PaymentRecord;
}

/* ──────────────────── API Functions ──────────────────── */

export function createPayment(body: CreatePaymentBody): Promise<PaymentRecord> {
  return api.post<PaymentRecord>('/payments', body);
}

export function getPayments(params?: PaymentsListParams): Promise<PaymentsListResponse> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.startDate) qs.set('dateFrom', params.startDate);
  if (params?.endDate) qs.set('dateTo', params.endDate);
  if (params?.paymentType) qs.set('paymentType', params.paymentType);
  if (params?.search) qs.set('search', params.search);
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<PaymentsListResponse>(`/payments${suffix}`);
}

export function getPayment(id: string): Promise<PaymentRecord> {
  return api.get<PaymentRecord>(`/payments/${id}`);
}

export function refundPayment(id: string, reason: string): Promise<RefundResponse> {
  return api.post<RefundResponse>(`/payments/${id}/refund`, { reason });
}

export interface CollectPaymentBody {
  amount: number; // centimes
  notes?: string;
}

export interface CollectPaymentResponse {
  memberId: string;
  applied: number;
  remainingBalance: number;
  affectedPayments: Array<{
    paymentId: string;
    receiptNumber: string;
    applied: number;
    remaining: number;
  }>;
}

export function collectMemberPayment(
  memberId: string,
  body: CollectPaymentBody,
): Promise<CollectPaymentResponse> {
  return api.post<CollectPaymentResponse>(
    `/payments/members/${memberId}/collect`,
    body,
  );
}
