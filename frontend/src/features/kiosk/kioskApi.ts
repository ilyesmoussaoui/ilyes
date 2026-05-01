import { api } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface MatchedMember {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
  status: string;
  disciplines: string[];
}

export interface MatchAlert {
  type: string;
  message: string;
}

export interface MatchSuccess {
  matched: true;
  confidence: number;
  member: MatchedMember;
  canAutoCheckIn: boolean;
  subscriptionStatus: 'active' | 'expired' | 'none';
  expiryDate: string | null;
  outstandingBalance: number; // centimes
  alreadyCheckedIn: boolean;
  lastCheckInTime: string | null;
  alerts: MatchAlert[];
}

export interface MatchFailure {
  matched: false;
  confidence: number;
  reason: 'no_face' | 'low_confidence' | 'no_match';
}

export type MatchResult = MatchSuccess | MatchFailure;

export interface KioskCheckInBody {
  member_id: string;
  method: 'face' | 'manual';
  discipline_id?: string;
  confidence?: number;
}

export interface CheckInResult {
  record: {
    id: string;
    memberId: string;
    checkInTime: string;
    method: string;
    status: 'present' | 'left';
    [key: string]: unknown;
  };
  member: MatchedMember;
  alerts: MatchAlert[];
}

export interface SearchMember {
  id: string;
  firstNameLatin: string;
  lastNameLatin: string;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
  subscriptionStatus: 'active' | 'expired' | 'none';
  disciplines: string[];
}

export interface SearchResult {
  members: SearchMember[];
}

export interface FaceServiceHealth {
  online: boolean;
  latencyMs: number | null;
}

/* ──────────────────── API Functions ──────────────────── */

export function matchFace(imageBase64: string): Promise<MatchResult> {
  return api.post<MatchResult>('/kiosk/match', { image_base64: imageBase64 });
}

export function kioskCheckIn(data: KioskCheckInBody): Promise<CheckInResult> {
  return api.post<CheckInResult>('/kiosk/check-in', data);
}

export function kioskSearch(query: string): Promise<SearchResult> {
  const qs = new URLSearchParams({ q: query });
  return api.get<SearchResult>(`/kiosk/search?${qs.toString()}`);
}

export function getFaceServiceHealth(): Promise<FaceServiceHealth> {
  return api.get<FaceServiceHealth>('/kiosk/face-service/health');
}
