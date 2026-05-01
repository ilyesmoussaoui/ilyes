import { api, apiFetch } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'equipment'
  | 'maintenance'
  | 'salaries'
  | 'insurance'
  | 'marketing'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

export interface ExpenseRecord {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number; // centimes
  description: string | null;
  receiptPath: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: { category: string; total: number; count: number }[];
  currentMonthTotal: number;
  previousMonthTotal: number;
  monthOverMonthPct: number | null;
  yearToDateTotal: number;
  dailyAverage: number;
  topCategory: { category: string; total: number } | null;
}

export interface ExpensesSummaryResponse {
  summary: ExpenseSummary;
}

export interface UploadReceiptResponse {
  expenseId: string;
  receiptPath: string;
}

export interface ExpensesListResponse {
  expenses: ExpenseRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpensesListParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateExpenseBody {
  date: string;
  category: ExpenseCategory;
  amount: number; // centimes
  description?: string;
}

export interface UpdateExpenseBody {
  date?: string;
  category?: ExpenseCategory;
  amount?: number;
  description?: string | null;
  receiptPath?: string | null;
}

/* ──────────────────── API Functions ──────────────────── */

export function getExpenses(params?: ExpensesListParams): Promise<ExpensesListResponse> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.startDate) qs.set('dateFrom', params.startDate);
  if (params?.endDate) qs.set('dateTo', params.endDate);
  if (params?.category) qs.set('category', params.category);
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<ExpensesListResponse>(`/expenses${suffix}`);
}

export async function createExpense(body: CreateExpenseBody): Promise<ExpenseRecord> {
  const res = await api.post<{ expense: ExpenseRecord }>('/expenses', body);
  return res.expense;
}

export async function updateExpense(
  id: string,
  body: UpdateExpenseBody,
): Promise<ExpenseRecord> {
  const res = await api.patch<{ expense: ExpenseRecord }>(`/expenses/${id}`, body);
  return res.expense;
}

export function deleteExpense(id: string): Promise<void> {
  return api.delete<void>(`/expenses/${id}`);
}

export async function getExpensesSummary(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<ExpenseSummary> {
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api.get<ExpensesSummaryResponse>(`/expenses/summary${suffix}`);
  return res.summary;
}

export async function uploadExpenseReceipt(
  expenseId: string,
  file: File,
): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadReceiptResponse>(`/expenses/${expenseId}/receipt`, {
    method: 'POST',
    body: formData,
  });
}

export function getReceiptUrl(filename: string): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  const baseUrl = (fromEnv && fromEnv.trim()) || 'http://localhost:4000';
  return `${baseUrl}/api/v1/expenses/receipts/${encodeURIComponent(filename)}`;
}
