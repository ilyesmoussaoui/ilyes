import { api } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface PosProduct {
  id: string;
  name: string;
  price: number; // centimes
  category: 'registration' | 'license' | 'equipment' | 'subscription' | 'other';
  barcode: string | null;
  inStock: boolean;
  stockQuantity: number | null; // null for non-inventory items (registration, license, etc.)
}

export interface PosProductsResponse {
  products: PosProduct[];
}

export interface PosCheckoutItem {
  productId: string | null;
  description: string;
  /** Per-unit price in centimes */
  unitPrice: number;
  quantity: number;
  type?: 'subscription' | 'equipment' | 'fee' | 'registration' | 'other';
}

export interface PosCheckoutBody {
  memberId: string | null;
  items: PosCheckoutItem[];
  paymentType: 'full' | 'partial' | 'later';
  paidAmount: number;
  notes?: string;
}

export interface PosCheckoutResponse {
  paymentId: string;
  receiptNumber: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
}

export interface MemberSearchResult {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  photoUrl: string | null;
}

export interface MemberSearchResponse {
  members: MemberSearchResult[];
}

/* ──────────────────── API Functions ──────────────────── */

export function getPosProducts(): Promise<PosProductsResponse> {
  return api.get<PosProductsResponse>('/pos/products');
}

export function lookupBarcode(barcode: string): Promise<{ product: PosProduct }> {
  return api.get<{ product: PosProduct }>(`/pos/barcode/${encodeURIComponent(barcode)}`);
}

export function posCheckout(body: PosCheckoutBody): Promise<PosCheckoutResponse> {
  return api.post<PosCheckoutResponse>('/pos/checkout', body);
}

export function searchMembers(query: string): Promise<MemberSearchResponse> {
  return api.get<MemberSearchResponse>(`/members/search?q=${encodeURIComponent(query)}`);
}

export interface MemberBalanceResult {
  balance: number;
}

export async function getMemberBalance(memberId: string): Promise<MemberBalanceResult> {
  const data = await api.get<{ member: { balance: number } }>(
    `/members/${memberId}/profile`,
  );
  return { balance: data.member.balance ?? 0 };
}

export interface FaceMatch {
  memberId: string;
  confidence: number;
  member: {
    firstNameLatin: string;
    lastNameLatin: string;
    photoPath?: string | null;
  };
}

export function faceSearch(blob: Blob): Promise<{ matches: FaceMatch[] }> {
  const formData = new FormData();
  formData.append('image', blob, 'capture.jpg');
  return api.post<{ matches: FaceMatch[] }>('/search/face', formData);
}
