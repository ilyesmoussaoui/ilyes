import { api } from '../../lib/api';

// ── General Settings ──────────────────────────────────────────────────

export interface ClubSettings {
  club_name: string;
  club_phone: string;
  club_email: string;
  club_address: string;
  club_city: string;
  club_logo: string | null;
  receipt_header: string;
  receipt_footer: string;
}

interface SettingsResponse {
  settings: ClubSettings;
}

export function fetchSettings() {
  return api.get<SettingsResponse>('/settings');
}

export function updateSettings(body: Partial<ClubSettings>) {
  // Filter out null/undefined values — backend schema requires string values
  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value != null) {
      settings[key] = String(value);
    }
  }
  return api.put<SettingsResponse>('/settings', { settings });
}

// ── Fee Settings ───────────────────────────────────────────────────────
// All values are stored and returned as centimes (integer).

export interface FeeSettings {
  registrationFee: number;
  licenseFee: number;
  extraSessionPrice: number;
}

interface FeeSettingsResponse {
  registrationFee: number;
  licenseFee: number;
  extraSessionPrice: number;
}

export function fetchFeeSettings(): Promise<FeeSettings> {
  return api.get<{ fees: FeeSettingsResponse }>('/settings/fees').then((data) => ({
    registrationFee: data.fees.registrationFee,
    licenseFee: data.fees.licenseFee,
    extraSessionPrice: data.fees.extraSessionPrice,
  }));
}

export function updateFeeSettings(body: Partial<FeeSettings>) {
  return api.put<{ fees: FeeSettingsResponse }>('/settings/fees', body);
}

// ── Users ─────────────────────────────────────────────────────────────

export interface SettingsUser {
  id: string;
  email: string;
  fullNameLatin: string;
  fullNameArabic: string | null;
  role: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface UsersResponse {
  users: SettingsUser[];
}

interface UserResponse {
  user: SettingsUser;
}

interface MessageResponse {
  message: string;
}

export function fetchUsers() {
  return api.get<UsersResponse>('/settings/users');
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullNameLatin: string;
  fullNameArabic?: string;
  roleId: string;
}

export function createUser(body: CreateUserPayload) {
  return api.post<UserResponse>('/settings/users', body);
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  fullNameLatin?: string;
  fullNameArabic?: string | null;
  roleId?: string;
  isActive?: boolean;
}

export function updateUser(id: string, body: UpdateUserPayload) {
  return api.put<UserResponse>(`/settings/users/${id}`, body);
}

export function deleteUser(id: string) {
  return api.delete<MessageResponse>(`/settings/users/${id}`);
}

// ── Roles ─────────────────────────────────────────────────────────────

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissions: string[];
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissions: string[];
}

interface RolesResponse {
  roles: RoleSummary[];
}

interface RoleResponse {
  role: RoleDetail;
}

export function fetchRoles() {
  return api.get<RolesResponse>('/settings/roles');
}

export function fetchRole(id: string) {
  return api.get<RoleResponse>(`/settings/roles/${id}`);
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions: string[];
}

export function createRole(body: CreateRolePayload) {
  return api.post<RoleResponse>('/settings/roles', body);
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

export function updateRole(id: string, body: UpdateRolePayload) {
  return api.put<RoleResponse>(`/settings/roles/${id}`, body);
}

export function deleteRole(id: string) {
  return api.delete<MessageResponse>(`/settings/roles/${id}`);
}

// ── Permissions Catalog ───────────────────────────────────────────────

export interface PermissionItem {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

interface PermissionsGroupedResponse {
  permissions: Record<string, Array<{ id: string; action: string; description: string | null }>>;
}

export async function fetchPermissions(): Promise<{ permissions: PermissionItem[] }> {
  const data = await api.get<PermissionsGroupedResponse>('/settings/permissions');
  const flat: PermissionItem[] = [];
  for (const [resource, actions] of Object.entries(data.permissions)) {
    for (const item of actions) {
      flat.push({ ...item, resource });
    }
  }
  return { permissions: flat };
}

// ── Disciplines ───────────────────────────────────────────────────────

export interface Discipline {
  id: string;
  name: string;
  isActive: boolean;
  activeEnrollments?: number;
}

interface DisciplinesResponse {
  disciplines: Discipline[];
}

interface DisciplineResponse {
  discipline: Discipline;
}

export function fetchDisciplines() {
  return api.get<DisciplinesResponse>('/settings/disciplines');
}

export function createDiscipline(body: { name: string }) {
  return api.post<DisciplineResponse>('/settings/disciplines', body);
}

export function updateDiscipline(id: string, body: { name?: string; isActive?: boolean }) {
  return api.put<DisciplineResponse>(`/settings/disciplines/${id}`, body);
}

export function deleteDiscipline(id: string) {
  return api.delete<MessageResponse>(`/settings/disciplines/${id}`);
}

// ── Pricing ───────────────────────────────────────────────────────────

export interface PricingPlan {
  id: string;
  planType: string;
  amount: number; // stored in centimes
  isActive: boolean;
}

export interface PricingGroup {
  disciplineId: string;
  disciplineName: string;
  plans: PricingPlan[];
}

interface PricingResponse {
  pricing: PricingGroup[];
}

interface PlanResponse {
  plan: {
    id: string;
    disciplineId: string;
    planType: string;
    amount: number;
    isActive: boolean;
    discipline: { id: string; name: string };
  };
}

export function fetchPricing() {
  return api.get<PricingResponse>('/settings/pricing');
}

export interface CreatePlanPayload {
  disciplineId: string;
  planType: string;
  amount: number; // centimes
}

export function createPlan(body: CreatePlanPayload) {
  return api.post<PlanResponse>('/settings/pricing', body);
}

export function updatePlan(id: string, body: { amount?: number; isActive?: boolean }) {
  return api.put<PlanResponse>(`/settings/pricing/${id}`, body);
}

export function deletePlan(id: string) {
  return api.delete<MessageResponse>(`/settings/pricing/${id}`);
}

// ── Documents ─────────────────────────────────────────────────────────

export interface DocumentRequirement {
  id: string;
  documentType: string;
  isRequired: boolean;
  memberTypes: string[]; // ['athlete', 'staff', 'external']
  validityMonths: number | null;
}

interface DocumentsResponse {
  requirements: DocumentRequirement[];
}

export function fetchDocumentRequirements() {
  return api.get<DocumentsResponse>('/settings/documents');
}

export function updateDocumentRequirements(requirements: DocumentRequirement[]) {
  return api.put<DocumentsResponse>('/settings/documents', { requirements });
}

// ── Notifications ─────────────────────────────────────────────────────

export interface NotificationSetting {
  id: string;
  type: string;
  isEnabled: boolean;
  daysBefore: number | null;
  template: string | null;
}

interface NotificationsResponse {
  settings: NotificationSetting[];
}

export function fetchNotificationSettings() {
  return api.get<NotificationsResponse>('/settings/notifications');
}

export function updateNotificationSettings(settings: NotificationSetting[]) {
  return api.put<NotificationsResponse>('/settings/notifications', { settings });
}
