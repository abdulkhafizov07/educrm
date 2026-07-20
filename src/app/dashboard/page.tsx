'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, cn, mediaUrl } from '@/lib/utils';
import { colorOf, type AccentColor } from '@/lib/colors';
import { StatCard } from '@/components/ui/StatCard';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import Link from 'next/link';

interface DashBranch {
  id: string; name: string; address: string | null; logo_url: string | null; colors: string[] | null;
  direction_name: string | null; direction_color: string | null;
  student_count: string; teacher_count: string; group_count: string;
}

interface DashGroup {
  id: string; name: string; branch_name: string | null;
  direction_name: string | null; direction_color: string | null;
  teacher_name: string | null; student_count: string; max_students: number;
}

interface DashboardStats {
  stats: {
    students: number;
    teachers: number;
    branches: number | null;
    groups: number;
  };
  attendanceToday: {
    total: string;
    present_count: string;
    absent_count: string;
    late_count: string;
  };
  attendanceTrend: Array<{
    session_date: string;
    present_count: string;
    absent_count: string;
    late_count: string;
    total: string;
  }>;
  recentActivity: Array<{
    action: string;
    entity_type: string;
    created_at: string;
    user_name: string;
    role: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<DashBranch[]>([]);
  const [groups, setGroups] = useState<DashGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    // Students only ever see their own attendance — not system/group totals
    if (user.role === 'student') { setLoading(false); return; }
    api.get<DashboardStats>('/api/dashboard/stats')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'super_admin' && user?.role !== 'observer') return;
    api.get<{ data: DashBranch[] }>('/api/branches', { limit: 8 })
      .then(d => setBranches(d.data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'super_admin' && user?.role !== 'branch_admin' && user?.role !== 'observer') return;
    // The API scopes automatically: branch admins only get their own branch's groups
    api.get<{ data: DashGroup[] }>('/api/groups', { is_active: true, limit: 8 })
      .then(d => setGroups(d.data))
      .catch(() => {});
  }, [user]);

  const today = data?.attendanceToday;
  const presentN = parseInt(today?.present_count || '0');
  const lateN = parseInt(today?.late_count || '0');
  const totalN = parseInt(today?.total || '0');
  const attendancePct = totalN > 0 ? Math.round(((presentN + lateN) / totalN) * 100) : 0;

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      USER_LOGIN: 'Logged in',
      USER_LOGOUT: 'Logged out',
      USER_CREATED: 'Created user',
      USER_UPDATED: 'Updated user',
      USER_DELETED: 'Deleted user',
      BRANCH_CREATED: 'Created branch',
      BRANCH_UPDATED: 'Updated branch',
      BRANCH_DELETED: 'Deleted branch',
      GROUP_CREATED: 'Created group',
      GROUP_UPDATED: 'Updated group',
      GROUP_DELETED: 'Deleted group',
      ATTENDANCE_SAVED: 'Saved attendance',
      PASSWORD_RESET: 'Reset password',
      STUDENT_ADDED_TO_GROUP: 'Added student to group',
    };
    return map[action] || action;
  };

  const activityStyle = (action: string): { color: string; icon: React.ReactNode } => {
    const plus = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
    const pencil = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
    const trash = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
    const login = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    const check = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    const key = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
    if (action.includes('CREATED') || action.includes('ADDED')) return { color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: plus };
    if (action.includes('DELETED') || action.includes('REMOVED')) return { color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: trash };
    if (action.includes('UPDATED')) return { color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', icon: pencil };
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return { color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: login };
    if (action.includes('ATTENDANCE')) return { color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: check };
    if (action.includes('PASSWORD')) return { color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', icon: key };
    return { color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: check };
  };

  // Students get a personal dashboard: only their own attendance, no system/group totals
  if (user?.role === 'student') {
    return <StudentDashboard userId={user.id} firstName={user.first_name} />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.first_name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
                <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('dashboard.totalStudents')}
              value={data?.stats.students ?? 0}
              color="blue"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            />
            <StatCard
              title={t('dashboard.totalTeachers')}
              value={data?.stats.teachers ?? 0}
              color="green"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            {data?.stats.branches !== null && (user?.role === 'super_admin' || user?.role === 'observer') ? (
              <StatCard
                title={t('dashboard.totalBranches')}
                value={data?.stats.branches ?? 0}
                color="purple"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              />
            ) : (
              <StatCard
                title={t('dashboard.attendanceRate')}
                value={`${attendancePct}%`}
                color="red"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              />
            )}
            <StatCard
              title={t('dashboard.totalGroups')}
              value={data?.stats.groups ?? 0}
              color="yellow"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
          </div>
        )}

        <AttendanceOverview attendanceToday={data?.attendanceToday} attendanceTrend={data?.attendanceTrend} />

        {/* Branches (super admin / observer) */}
        {(user?.role === 'super_admin' || user?.role === 'observer') && branches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </span>
                {t('nav.branches')}
              </h2>
              <Link href="/branches" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t('common.viewAll')}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {branches.map(b => {
                const colors = (b.colors && b.colors.length ? b.colors : []) as string[];
                const ac = (colors[0] as AccentColor) || null;
                const c = ac ? colorOf(ac) : null;
                const stats = [
                  { v: b.student_count, l: t('branches.students'), d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                  { v: b.teacher_count, l: t('branches.teachers'), d: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
                  { v: b.group_count, l: t('branches.groups'), d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                ];
                return (
                  <Link key={b.id} href={`/branches/${b.id}`}
                    className={cn(
                      'group relative flex flex-col bg-white dark:bg-gray-900 rounded-xl border overflow-hidden shadow-sm',
                      'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                      c ? c.border : 'border-gray-200 dark:border-gray-800'
                    )}
                  >
                    {/* Colour strip */}
                    {colors.length > 0 ? (
                      <div className="flex h-1.5 w-full shrink-0">
                        {colors.map((col, i) => <div key={i} className={cn('flex-1', colorOf(col).solid)} />)}
                      </div>
                    ) : (
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 shrink-0" />
                    )}

                    {/* Logo header */}
                    <div className={cn('h-20 flex items-center justify-center relative overflow-hidden', c ? c.bg : 'bg-gray-50 dark:bg-gray-800/60')}>
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(b.logo_url) || ''} alt={b.name} className="h-12 w-auto max-w-[70%] object-contain transition-transform duration-200 group-hover:scale-105" />
                      ) : (
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', c ? cn(c.bg, c.text) : 'bg-white dark:bg-gray-900 text-gray-400', 'ring-1 ring-black/5')}>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex flex-col p-4">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {b.name}
                      </h3>
                      {b.direction_name ? (
                        <span className={cn('inline-flex items-center self-start mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium', colorOf(b.direction_color).bg, colorOf(b.direction_color).text)}>
                          {b.direction_name}
                        </span>
                      ) : (
                        b.address ? <p className="text-xs text-gray-400 truncate mt-1">{b.address}</p> : <div className="mt-1 h-[18px]" />
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        {stats.map((s, i) => (
                          <div key={i} title={s.l} className={cn('flex flex-col items-center gap-0.5 rounded-lg py-1.5', c ? c.bg : 'bg-gray-50 dark:bg-gray-800/60')}>
                            <svg className={cn('w-3.5 h-3.5', c ? c.text : 'text-gray-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.d} />
                            </svg>
                            <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">{s.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hover arrow */}
                    <svg className="absolute top-3 right-3 w-4 h-4 text-white/0 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Groups */}
        {(user?.role === 'super_admin' || user?.role === 'branch_admin' || user?.role === 'observer') && groups.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </span>
                {t('nav.groups')}
              </h2>
              <Link href="/groups" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t('common.viewAll')}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {groups.map(g => {
                const c = g.direction_color ? colorOf(g.direction_color as AccentColor) : null;
                return (
                  <Link key={g.id} href={`/groups/${g.id}`}
                    className={cn(
                      'group relative flex flex-col bg-white dark:bg-gray-900 rounded-xl border overflow-hidden shadow-sm p-4',
                      'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
                      c ? c.border : 'border-gray-200 dark:border-gray-800'
                    )}
                  >
                    {/* Colour accent */}
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1', c ? c.solid : 'bg-gray-200 dark:bg-gray-700')} />

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {g.name}
                      </h3>
                      {g.direction_name && (
                        <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium', c ? cn(c.bg, c.text) : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>
                          {g.direction_name}
                        </span>
                      )}
                    </div>

                    {g.branch_name && (
                      <p className="flex items-center gap-1 text-xs text-gray-400 truncate mt-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {g.branch_name}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="truncate">{g.teacher_name || '—'}</span>
                      </span>
                      <span className={cn('shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold', c ? cn(c.bg, c.text) : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        {g.student_count}/{g.max_students}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.recentActivity')}</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex gap-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                  </div>
                </div>
              ))
            ) : data?.recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">{t('common.noData')}</div>
            ) : (
              data?.recentActivity.map((item, i) => {
                const ac = activityStyle(item.action);
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${ac.color}`}>
                      {ac.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">{item.user_name || 'Unknown'}</span>
                        <span className="text-gray-500 dark:text-gray-400"> {actionLabel(item.action)}</span>
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(item.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ---- Student dashboard: the student's own attendance over the last 7 days ----
interface OwnStats { total: number; present: number; absent: number; late: number; avgLate: number; attendancePct: number; }
interface OwnRec { id: string; session_date: string; group_name: string; status: string; late_minutes: number; teacher_name: string; }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function StudentDashboard({ userId, firstName }: { userId: string; firstName?: string }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<OwnStats | null>(null);
  const [records, setRecords] = useState<OwnRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6); // last 7 days, inclusive of today
    api.get<{ records: OwnRec[]; stats: OwnStats }>(
      `/api/attendance/student/${userId}`,
      { from_date: ymd(from), to_date: ymd(to) }
    )
      .then(d => { setStats(d.stats); setRecords(d.records); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const statusStyle: Record<string, string> = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };

  // Last-7-days counts: how many times present / late / absent
  const cards = [
    { l: t('attendance.present'), v: stats?.present ?? 0, c: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' },
    { l: t('attendance.late'), v: stats?.late ?? 0, c: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300' },
    { l: t('attendance.absent'), v: stats?.absent ?? 0, c: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.last7Days')}</h2>
          <div className="grid grid-cols-3 gap-4">
            {cards.map((c, i) => (
              <div key={i} className={`rounded-lg border p-5 ${c.c}`}>
                <p className="text-2xl font-semibold">{loading ? '—' : c.v}</p>
                <p className="text-xs mt-1 opacity-80">{c.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('dashboard.last7Days')}</h2>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.loading')}</div>
          ) : records.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">{t('attendance.noSessions')}</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {records.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(r.session_date)}</p>
                    <p className="text-xs text-gray-400 truncate">{r.group_name}{r.teacher_name ? ` · ${r.teacher_name}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusStyle[r.status] || ''}`}>
                    {t(`attendance.${r.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}