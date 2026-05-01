export type Role = 'admin' | 'manager' | 'receptionist' | 'coach' | 'accountant';

export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  fullNameLatin: string;
  fullNameArabic: string | null;
  lastLogin: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface MeResponse {
  user: UserSummary;
  permissions: string[];
}

export interface LoginResponse {
  user: UserSummary;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorShape;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
