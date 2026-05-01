import { api } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface EquipmentItem {
  id: string;
  name: string;
  price: number; // centimes
  stockQuantity: number;
  disciplineId: string | null;
  disciplineName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentListResponse {
  equipment: EquipmentItem[];
  total: number;
  page: number;
  totalPages: number;
  totalValue: number; // centimes — sum of (price * stockQuantity) for all items
  lowStockCount: number;
}

export interface EquipmentListParams {
  search?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

export interface EquipmentDetail extends EquipmentItem {
  stockAdjustments: StockAdjustment[];
}

export interface CreateEquipmentBody {
  name: string;
  price: number; // centimes
  stockQuantity: number;
  disciplineId?: string | null;
}

export interface UpdateEquipmentBody {
  name?: string;
  price?: number; // centimes
  disciplineId?: string | null;
}

export type StockAdjustmentReason =
  | 'manual_add'
  | 'manual_remove'
  | 'correction'
  | 'initial_stock';

export interface StockAdjustBody {
  quantityChange: number;
  reason: StockAdjustmentReason;
  notes?: string;
}

export interface StockAdjustment {
  id: string;
  equipmentId: string;
  quantityChange: number;
  reason: string;
  notes: string | null;
  performedBy: string;
  createdAt: string;
}

export interface StockHistoryResponse {
  history: StockAdjustment[];
}

export interface MemberEquipmentPurchase {
  id: string;
  equipmentName: string;
  quantity: number;
  unitPrice: number; // centimes
  purchaseDate: string;
  paymentReceiptNo: string | null;
}

export interface MemberEquipmentResponse {
  history: MemberEquipmentPurchase[];
}

/* ──────────────────── API Functions ──────────────────── */

export function getEquipmentList(params?: EquipmentListParams): Promise<EquipmentListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.lowStock) qs.set('lowStock', 'true');
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<EquipmentListResponse>(`/inventory${suffix}`);
}

export function getEquipmentDetail(id: string): Promise<{ equipment: EquipmentDetail }> {
  return api.get<{ equipment: EquipmentDetail }>(`/inventory/${id}`);
}

export function createEquipment(body: CreateEquipmentBody): Promise<{ equipment: EquipmentItem }> {
  return api.post<{ equipment: EquipmentItem }>('/inventory', body);
}

export function updateEquipment(id: string, body: UpdateEquipmentBody): Promise<{ equipment: EquipmentItem }> {
  return api.patch<{ equipment: EquipmentItem }>(`/inventory/${id}`, body);
}

export function deactivateEquipment(id: string): Promise<void> {
  return api.delete<void>(`/inventory/${id}`);
}

export function adjustStock(
  id: string,
  body: StockAdjustBody,
): Promise<{ equipment: EquipmentItem; adjustment: StockAdjustment }> {
  return api.post<{ equipment: EquipmentItem; adjustment: StockAdjustment }>(
    `/inventory/${id}/adjust`,
    body,
  );
}

export function getStockHistory(id: string): Promise<StockHistoryResponse> {
  return api.get<StockHistoryResponse>(`/inventory/${id}/history`);
}

export function getMemberEquipmentHistory(memberId: string): Promise<MemberEquipmentResponse> {
  return api.get<MemberEquipmentResponse>(`/members/${memberId}/equipment-history`);
}
