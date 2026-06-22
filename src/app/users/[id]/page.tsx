'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, getAttendanceColor } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserDetail {
  id: string; username: string; email: string | null; first_name: string; last_name: string;
  phone: string | null; role: string; branch_id: string | null; branch_name: string | null;
  avatar_url: string | null; is_active: boolean; last_login: string | null; created_at: string;
}

interface AttendanceRecord {
  session_date: string; status: string; group_name: string; late_minutes: number; arrival_time: string | null;
}

interface AttendanceStats {
  total: number; present: number; absent: number; late: number; avgLate: number; attendancePct: number;
}

interface Group { id: string; name: string; branch_name: string; }

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserDetail | null>(null);
  const [attendance, setAttendance] = useState<{ records: AttendanceRecord[]; stats: AttendanceStats } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<UserDetail>(`/api/users/${id}`),
      api.get<{ records: AttendanceRecord[]; stats: AttendanceStats }>(`/api/attendance/student/${id}`),
      api.get<{ data: Group[] }>(`/api/groups`, { page: 1, limit: 100 }),
    ]).then(([u, att, grps]) => {
      setProfile(u);
      setAttendance(att);
      setGroups(grps.data.filter(g => true));
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, [id]);

  const roleVariant = (role: string): 'info' | 'danger' | 'success' | 'warning' | 'purple' => {
    const map: Record<string, 'info' | 'danger' | 'success' | 'warning' | 'purple'> = {
      super_admin: 'danger', branch_admin: 'purple', teacher: 'info', student: 'success'
    };
    return map[role] || 'info';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-gray-400">{t('errors.notFound')}</div>
      </DashboardLayout>
    );
  }

  const stats = attendance?.stats;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        {/* Profile card */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start gap-5">
            <Avatar firstName={profile.first_name} lastName={profile.last_name} avatarUrl={profile.avatar_url} size="xl" />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {profile.first_name} {profile.last_name}
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">@{profile.username}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={roleVariant(profile.role)}>{t(`users.roles.${profile.role}`)}</Badge>
                  <Badge variant={profile.is_active ? 'success' : 'default'}>
                    {profile.is_active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {profile.email && (
                  <div>
                    <p className="text-xs text-gray-400">{t('common.email')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{profile.email}</p>
                  </div>
                )}
                {profile.phone && (
                  <div>
                    <p className="text-xs text-gray-400">{t('common.phone')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{profile.phone}</p>
                  </div>
                )}
                {profile.branch_name && (
                  <div>
                    <p className="text-xs text-gray-400">{t('common.branch')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{profile.branch_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">{t('profile.memberSince')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(profile.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{t('common.lastLogin')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{profile.last_login ? formatDateTime(profile.last_login) : t('common.never')}</p>
                </div>
              </div>

              {(currentUser?.role === 'super_admin' || currentUser?.role === 'branch_admin') && (
                <div className="mt-4 flex gap-2">
                  <Link href={`/users?edit=${profile.id}`}>
                    <Button variant="outline" size="sm">{t('users.editUser')}</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: t('attendance.attendanceRate'), value: `${stats.attendancePct}%`, color: 'text-indigo-600' },
              { label: t('attendance.totalPresent'), value: stats.present, color: 'text-green-600' },
              { label: t('attendance.totalAbsent'), value: stats.absent, color: 'text-red-600' },
              { label: t('attendance.totalLate'), value: stats.late, color: 'text-amber-600' },
              { label: t('attendance.avgLateMinutes'), value: stats.avgLate > 0 ? `${stats.avgLate}m` : '—', color: 'text-orange-600' },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-4 text-center">
                <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Attendance history */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('attendance.history')}</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {!attendance?.records.length ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">{t('common.noData')}</div>
            ) : (
              attendance.records.slice(0, 30).map((rec, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{rec.group_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(rec.session_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {rec.status === 'late' && rec.late_minutes > 0 && (
                      <span className="text-xs text-amber-600">{t('attendance.lateBy')} {rec.late_minutes} {t('attendance.minutes')}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAttendanceColor(rec.status)}`}>
                      {t(`attendance.${rec.status}`)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
