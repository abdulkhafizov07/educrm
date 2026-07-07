import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date | null, locale = 'en-US'): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date | null, locale = 'en-US'): string {
  if (!date) return '—';
  return new Date(date).toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.substring(0, 5); // HH:MM
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Resolve an uploaded file path to a full URL (static files are served by the API on a different port). */
export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

export const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayName(day: number, t: (key: string) => string): string {
  return t(`schedule.days.${day}`);
}

export function calcLateMinutes(classStart: string, arrivalTime: string): number {
  const [sh, sm] = classStart.split(':').map(Number);
  const [ah, am] = arrivalTime.split(':').map(Number);
  const diff = (ah * 60 + am) - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

export function getAttendanceColor(status: string): string {
  switch (status) {
    case 'present': return 'text-green-600 bg-green-50';
    case 'absent': return 'text-red-600 bg-red-50';
    case 'late': return 'text-amber-600 bg-amber-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

export const ROLES = ['super_admin', 'branch_admin', 'teacher', 'student'] as const;
export type UserRole = typeof ROLES[number];
