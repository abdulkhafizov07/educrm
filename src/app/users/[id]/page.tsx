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
  graduated_at: string | null;
  address: string | null; mother_phone: string | null; birth_year: number | null;
  father_name: string | null; mother_name: string | null;
}

interface AttendanceRecord {
  session_date: string; status: string; group_name: string; late_minutes: number; arrival_time: string | null;
  grade: number | null; is_exam: boolean;
}

interface AttendanceStats {
  total: number; present: number; absent: number; late: number; avgLate: number; attendancePct: number; avgGrade: number | null;
}

interface Group { id: string; name: string; branch_name: string; direction_name: string | null; student_count: string; max_students: number; is_active: boolean; }

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
    let active = true;
    setLoading(true);
    api.get<UserDetail>(`/api/users/${id}`)
      .then(async (u) => {
        if (!active) return;
        setProfile(u);
        // Role-specific section: students -> own attendance, teachers -> their groups
        if (u.role === 'student') {
          const att = await api.get<{ records: AttendanceRecord[]; stats: AttendanceStats }>(`/api/attendance/student/${id}`);
          if (active) setAttendance(att);
        } else if (u.role === 'teacher') {
          const grps = await api.get<{ data: Group[] }>(`/api/groups`, { teacher_id: id, limit: 100 });
          if (active) setGroups(grps.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
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
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
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
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        {/* Profile card */}
        <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full " />

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                avatarUrl={profile.avatar_url}
                size="xl"
                className="ring-4 ring-blue-100 dark:ring-blue-900/30"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {profile.first_name} {profile.last_name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{profile.username}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={roleVariant(profile.role)} className="text-xs">
                      {t(`users.roles.${profile.role}`)}
                    </Badge>
                    <Badge variant={profile.is_active ? 'success' : 'default'} className="text-xs">
                      {profile.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                    {profile.graduated_at && (
                      <Badge variant="purple" className="text-xs">
                        {t('users.graduated')} · {formatDate(profile.graduated_at)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {profile.email && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('common.email')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{profile.email}</p>
                      </div>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('common.phone')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.phone}</p>
                      </div>
                    </div>
                  )}
                  {profile.branch_name && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('common.branch')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.branch_name}</p>
                      </div>
                    </div>
                  )}
                  {profile.address && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('users.address')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.address}</p>
                      </div>
                    </div>
                  )}
                  {profile.father_name && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('users.fatherName')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.father_name}</p>
                      </div>
                    </div>
                  )}
                  {profile.mother_name && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('users.motherName')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.mother_name}</p>
                      </div>
                    </div>
                  )}
                  {profile.mother_phone && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('users.motherPhone')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{profile.mother_phone}</p>
                      </div>
                    </div>
                  )}
                  {profile.birth_year && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">{t('users.birthYear')}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {profile.birth_year} · {t('users.age')}: {new Date().getFullYear() - profile.birth_year}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-xs text-gray-400">{t('profile.memberSince')}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(profile.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs text-gray-400">{t('common.lastLogin')}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {profile.last_login ? formatDateTime(profile.last_login) : t('common.never')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit button */}
                {(currentUser?.role === 'super_admin' || currentUser?.role === 'branch_admin') && (
                  <div className="mt-5">
                    <Link href={`/users/${profile.role === 'student' ? 'students' : 'staff'}?edit=${profile.id}`}>
                      <Button variant="outline" size="sm" className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20">
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t('users.editUser')}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Teacher's groups */}
        {profile.role === 'teacher' && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('branches.groups')} ({groups.length})</h2>
            </div>
            {groups.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {groups.map(g => (
                  <Link key={g.id} href={`/groups/${g.id}`} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{g.name}</p>
                      <p className="text-xs text-gray-400 truncate">{g.branch_name}{g.direction_name ? ` · ${g.direction_name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{g.student_count}/{g.max_students}</span>
                      <Badge variant={g.is_active ? 'success' : 'default'}>{g.is_active ? t('common.active') : t('common.inactive')}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance stats (students only) */}
        {profile.role === 'student' && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: t('attendance.attendanceRate'), value: `${stats.attendancePct}%`, color: 'indigo', icon: 'chart' },
              { label: t('attendance.totalPresent'), value: stats.present, color: 'green', icon: 'check' },
              { label: t('attendance.totalAbsent'), value: stats.absent, color: 'red', icon: 'x' },
              { label: t('attendance.totalLate'), value: stats.late, color: 'amber', icon: 'clock' },
              ...(stats.avgGrade !== null ? [{ label: t('attendance.avgGrade'), value: stats.avgGrade, color: 'purple', icon: 'star' }] : []),
              { label: t('attendance.avgLateMinutes'), value: stats.avgLate > 0 ? `${stats.avgLate}m` : '—', color: 'orange', icon: 'timer' },
            ].map((s, i) => {
              const colorMap = {
                indigo: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
                red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
                amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
                purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
              };
              const iconMap = {
                chart: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                ),
                check: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ),
                x: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ),
                clock: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                timer: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                star: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.362-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                ),
              };
              return (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center shadow-sm hover:shadow-md transition-all">
                  <div className={`inline-flex p-1.5 rounded-lg ${colorMap[s.color as keyof typeof colorMap]} mb-1`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {iconMap[s.icon as keyof typeof iconMap]}
                    </svg>
                  </div>
                  <div className={`text-xl font-bold ${colorMap[s.color as keyof typeof colorMap].split(' ')[2]}`}>
                    {s.value}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Attendance history (students only) */}
        {profile.role === 'student' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('attendance.history')}</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {!attendance?.records.length ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{t('common.noData')}</span>
              </div>
            ) : (
              attendance.records.slice(0, 30).map((rec, i) => (
                <div key={i} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${rec.status === 'present' ? 'bg-green-500' : rec.status === 'absent' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{rec.group_name}</p>
                      <p className="text-xs text-gray-400">{formatDate(rec.session_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rec.status === 'late' && rec.late_minutes > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t('attendance.lateBy')} {rec.late_minutes} {t('attendance.minutes')}
                      </span>
                    )}
                    {rec.is_exam && rec.grade !== null && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                        {t('attendance.grade')}: {rec.grade}
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getAttendanceColor(rec.status)}`}>
                      {t(`attendance.${rec.status}`)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </DashboardLayout>
  );
}