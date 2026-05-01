import { api } from '../../lib/api';

/* ──────────────────── Types ──────────────────── */

export interface SessionDiscipline {
  id: string;
  name: string;
}

export interface SessionCoach {
  id: string;
  fullNameLatin: string;
}

export interface TimeSlot {
  id: string;
  disciplineId: string;
  discipline: SessionDiscipline;
  coachId: string | null;
  coach: SessionCoach | null;
  dayOfWeek: number; // 0=Sun, 6=Sat
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  maxCapacity: number;
  currentEnrollment: number;
  room: string | null;
}

export interface TimeSlotsResponse {
  timeSlots: TimeSlot[];
}

export interface TimeSlotCreateBody {
  disciplineId: string;
  coachId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  room?: string;
}

export interface TimeSlotUpdateBody {
  disciplineId?: string;
  coachId?: string | null;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  maxCapacity?: number;
  room?: string | null;
}

export interface TimeSlotWarning {
  type: string;
  message: string;
}

export interface TimeSlotMutationResponse {
  timeSlot: TimeSlot;
  warnings: TimeSlotWarning[];
}

export interface RosterMember {
  scheduleId: string;
  memberId: string;
  member: {
    id: string;
    firstNameLatin: string | null;
    lastNameLatin: string | null;
    photoPath: string | null;
  };
  attendanceToday: { id: string; checkInTime: string } | null;
}

export interface RosterResponse {
  timeSlot: {
    id: string;
    discipline: SessionDiscipline;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    dayOfWeek: number;
    coach: SessionCoach | null;
  };
  roster: RosterMember[];
  enrollment: { current: number; max: number };
}

export interface AttendanceToggleBody {
  memberId: string;
  present: boolean;
}

/** Backend returns { record: {...} } on present=true, { removed: true } on present=false */
export type AttendanceToggleResponse =
  | { record: { id: string; checkInTime: string } }
  | { removed: true };

export interface ConflictCheckBody {
  coachId?: string;
  room?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeId?: string;
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  conflicts: Array<{ type: string; message: string }>;
}

export interface DisciplineOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface DisciplinesResponse {
  disciplines: DisciplineOption[];
}

export interface CoachOption {
  id: string;
  fullNameLatin: string;
  fullNameArabic?: string | null;
}

export interface CoachesResponse {
  coaches: CoachOption[];
}

export interface EnrollMemberBody {
  memberId: string;
}

export interface EnrollMemberResponse {
  schedule: {
    id: string;
    memberId: string;
    member: {
      id: string;
      firstNameLatin: string | null;
      lastNameLatin: string | null;
      photoPath: string | null;
    };
  };
  enrollment: { current: number; max: number };
  nearCapacity: boolean;
  warning: string | null;
}

/* ──────────────────── API Functions ──────────────────── */

export function getTimeSlots(dayOfWeek?: number): Promise<TimeSlotsResponse> {
  const suffix = dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : '';
  return api.get<TimeSlotsResponse>(`/sessions/time-slots${suffix}`);
}

export function createTimeSlot(body: TimeSlotCreateBody): Promise<TimeSlotMutationResponse> {
  return api.post<TimeSlotMutationResponse>('/sessions/time-slots', body);
}

export function updateTimeSlot(
  id: string,
  body: TimeSlotUpdateBody,
): Promise<TimeSlotMutationResponse> {
  return api.put<TimeSlotMutationResponse>(`/sessions/time-slots/${id}`, body);
}

export function deleteTimeSlot(id: string): Promise<void> {
  return api.delete<void>(`/sessions/time-slots/${id}`);
}

export function getTimeSlotRoster(id: string): Promise<RosterResponse> {
  return api.get<RosterResponse>(`/sessions/time-slots/${id}/roster`);
}

export function toggleAttendance(
  slotId: string,
  body: AttendanceToggleBody,
): Promise<AttendanceToggleResponse> {
  return api.post<AttendanceToggleResponse>(
    `/sessions/time-slots/${slotId}/attendance`,
    body,
  );
}

export function checkConflicts(body: ConflictCheckBody): Promise<ConflictCheckResponse> {
  return api.post<ConflictCheckResponse>('/sessions/check-conflicts', body);
}

export function getDisciplines(): Promise<DisciplinesResponse> {
  return api.get<DisciplinesResponse>('/disciplines');
}

export function getCoaches(): Promise<CoachesResponse> {
  return api.get<CoachesResponse>('/sessions/coaches');
}

export function enrollMember(
  slotId: string,
  body: EnrollMemberBody,
): Promise<EnrollMemberResponse> {
  return api.post<EnrollMemberResponse>(`/sessions/time-slots/${slotId}/enroll`, body);
}

export function unenrollMember(slotId: string, memberId: string): Promise<void> {
  return api.delete<void>(`/sessions/time-slots/${slotId}/members/${memberId}`);
}
