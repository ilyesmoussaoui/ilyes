const LATIN_ALLOWED = /[^A-Za-z\s\-']/g;
const LATIN_ANY = /[A-Za-z]/;
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const DOUBLE_SPACE = /\s{2,}/g;
const XSS_STRIP = /[<>`]/g;

export const MAX_NAME_LENGTH = 40;
export const MAX_ADDRESS_LENGTH = 200;

export function sanitizeLatinName(value: string): string {
  return value.replace(LATIN_ALLOWED, '').replace(DOUBLE_SPACE, ' ').slice(0, MAX_NAME_LENGTH);
}

export function capitalizeWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      const parts = w.split('-');
      return parts
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p))
        .join('-');
    })
    .join(' ');
}

export function sanitizeArabicName(value: string): string {
  if (LATIN_ANY.test(value)) {
    return value.replace(/[A-Za-z]/g, '').slice(0, MAX_NAME_LENGTH);
  }
  return value.slice(0, MAX_NAME_LENGTH);
}

export function isArabicText(value: string): boolean {
  if (!value) return true;
  if (LATIN_ANY.test(value)) return false;
  return ARABIC_RANGE.test(value);
}

export function sanitizeEmailInput(value: string): string {
  return value.replace(XSS_STRIP, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function formatAlgerianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const groups: string[] = [];
  if (digits.length > 0) groups.push(digits.slice(0, 2));
  if (digits.length > 2) groups.push(digits.slice(2, 4));
  if (digits.length > 4) groups.push(digits.slice(4, 6));
  if (digits.length > 6) groups.push(digits.slice(6, 8));
  if (digits.length > 8) groups.push(digits.slice(8, 10));
  return groups.join(' ');
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function isValidAlgerianPhone(value: string): boolean {
  const digits = phoneDigits(value);
  if (digits.length !== 10) return false;
  if (digits[0] !== '0') return false;
  const second = digits[1];
  return second === '5' || second === '6' || second === '7';
}

export function computeAge(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}

export function schoolLevelForAge(age: number): string {
  if (age < 6) return 'Pre-school';
  if (age <= 10) return 'Primary';
  if (age <= 14) return 'Middle school';
  if (age <= 18) return 'High school';
  return 'Adult';
}

export function isFutureDate(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
}
