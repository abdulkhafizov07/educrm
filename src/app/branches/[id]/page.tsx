'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { StatCard } from '@/components/ui/StatCard';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import { formatDate, mediaUrl, cn } from '@/lib/utils';
import { colorOf } from '@/lib/colors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BranchDetail {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  logo_url?: string | null;
  teacher_count: string;
  student_count: string;
  admin_count: string;
  group_count: string;
  groups: Array<{
    id: string;
    name: string;
    max_students: number;
    is_active: boolean;
    teacher_name: string | null;
    student_count: string;
  }>;
  admins: Array<{
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    avatar_url: string | null;
  }>;
  teachers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    avatar_url: string | null;
    direction_name: string | null;
    group_count: string;
  }>;
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    avatar_url: string | null;
    phone: string | null;
    direction_name: string | null;
    group_names: string | null;
  }>;
  directions: Array<{
    id: string;
    name: string;
    color: string;
    logo_url: string | null;
    group_count: string;
  }>;
  attendanceToday?: { total: string; present_count: string; absent_count: string; late_count: string };
  attendanceTrend?: Array<{ session_date: string; present_count: string; absent_count: string; late_count: string; total: string }>;
}

// Ikonkalar
const StudentsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const TeachersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const GroupsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  // Clicking a stat card opens the matching list right below the stats
  const [openList, setOpenList] = useState<'students' | 'teachers' | 'groups' | 'admins' | null>(null);

  useEffect(() => {
    api.get<BranchDetail>(`/api/branches/${id}`)
      .then(setBranch)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogoModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  if (!branch) return null;

  const teachers = branch.teachers ?? [];
  const admins = branch.admins ?? [];
  const groups = branch.groups ?? [];
  const directions = branch.directions ?? [];
  const students = branch.students ?? [];

  const statCards = [
    { key: 'students' as const, label: t('branches.students'), value: branch.student_count, icon: <StudentsIcon />, color: 'blue' as const },
    { key: 'teachers' as const, label: t('branches.teachers'), value: branch.teacher_count, icon: <TeachersIcon />, color: 'green' as const },
    { key: 'groups' as const, label: t('branches.groups'), value: branch.group_count, icon: <GroupsIcon />, color: 'yellow' as const },
    { key: 'admins' as const, label: t('users.roles.branch_admin'), value: branch.admin_count, icon: <AdminIcon />, color: 'purple' as const },
  ];

  // Rows for the expandable list panel under the stat cards.
  // Every person row shows filial (this page) + yo'nalish + guruh where relevant.
  const listPanel = openList && (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {statCards.find(s => s.key === openList)?.label} ({{ students: students.length, teachers: teachers.length, groups: groups.length, admins: admins.length }[openList]})
        </h2>
        <button onClick={() => setOpenList(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          {t('common.close')}
        </button>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
        {openList === 'students' && (students.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : students.map(s => (
          <Link key={s.id} href={`/users/${s.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.first_name} {s.last_name}</p>
              <p className="text-xs text-gray-400 truncate">
                @{s.username} · {branch.name}
                {s.direction_name ? ` · ${s.direction_name}` : ''}
                {s.group_names ? ` · ${s.group_names}` : ''}
              </p>
            </div>
            {s.phone && <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{s.phone}</span>}
          </Link>
        )))}
        {openList === 'teachers' && (teachers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : teachers.map(tc => (
          <Link key={tc.id} href={`/users/${tc.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <Avatar firstName={tc.first_name} lastName={tc.last_name} avatarUrl={tc.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tc.first_name} {tc.last_name}</p>
              <p className="text-xs text-gray-400 truncate">
                @{tc.username} · {branch.name}
                {tc.direction_name ? ` · ${tc.direction_name}` : ''}
              </p>
            </div>
            <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{tc.group_count} {t('branches.groups')}</span>
          </Link>
        )))}
        {openList === 'groups' && (groups.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : groups.map(g => (
          <Link key={g.id} href={`/groups/${g.id}`} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{g.name}</p>
              <p className="text-xs text-gray-400 truncate">{g.teacher_name || '—'}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm text-gray-500 dark:text-gray-400">{g.student_count}/{g.max_students}</span>
              <Badge variant={g.is_active ? 'success' : 'default'}>{g.is_active ? t('common.active') : t('common.inactive')}</Badge>
            </div>
          </Link>
        )))}
        {openList === 'admins' && (admins.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
        ) : admins.map(a => (
          <Link key={a.id} href={`/users/${a.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <Avatar firstName={a.first_name} lastName={a.last_name} avatarUrl={a.avatar_url} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.first_name} {a.last_name}</p>
              <p className="text-xs text-gray-400 truncate">@{a.username} · {branch.name}</p>
            </div>
          </Link>
        )))}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        {/* Branch header with clickable logo */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 flex items-start gap-6 shadow-sm">
          <div
            className="w-24 h-24 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 border border-gray-200 dark:border-gray-700 cursor-pointer transition-transform hover:scale-105"
            onClick={() => branch.logo_url && setLogoModalOpen(true)}
          >
            {branch.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(branch.logo_url) || ''} alt={branch.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{branch.name}</h1>
                {branch.address && <p className="text-sm text-gray-400 mt-0.5">{branch.address}</p>}
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {branch.phone && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {branch.phone}
                    </span>
                  )}
                  {branch.email && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {branch.email}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={branch.is_active ? 'success' : 'default'}>
                {branch.is_active ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats — same card style as the dashboard's top stat row; click to open the list */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenList(openList === s.key ? null : s.key)}
              className={cn('text-left w-full cursor-pointer rounded-lg transition', openList === s.key && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950')}
            >
              <StatCard title={s.label} value={s.value} icon={s.icon} color={s.color} />
            </button>
          ))}
        </div>

        {/* Expanded list for the clicked stat */}
        {listPanel}

        {/* Attendance — same charts as the dashboard, scoped to this branch's groups only */}
        <AttendanceOverview attendanceToday={branch.attendanceToday} attendanceTrend={branch.attendanceTrend} />

        {/* Directions in this branch */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('nav.directions')} ({directions.length})
            </h2>
          </div>
          {directions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">{t('common.noData')}</div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {directions.map(d => {
                const c = colorOf(d.color);
                return (
                  <Link
                    key={d.id}
                    href={`/directions/${d.id}`}
                    className={cn('flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow', c.border)}
                  >
                    <div className={cn('w-9 h-9 rounded flex items-center justify-center shrink-0', c.bg, c.text)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.group_count} {t('branches.groups')}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups list */}
          <div className="lg:col-span-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('branches.groups')} ({groups.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {groups.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
              ) : (
                groups.map(g => (
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{g.name}</p>
                      <p className="text-xs text-gray-400">{g.teacher_name || '—'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{g.student_count}/{g.max_students}</span>
                      <Badge variant={g.is_active ? 'success' : 'default'}>
                        {g.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right sidebar: admins + teachers */}
          <div className="space-y-6">
            {/* Branch admins */}
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('users.roles.branch_admin')}</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {admins.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
                ) : (
                  admins.map(a => (
                    <Link
                      key={a.id}
                      href={`/users/${a.id}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <Avatar firstName={a.first_name} lastName={a.last_name} avatarUrl={a.avatar_url} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{a.first_name} {a.last_name}</p>
                        <p className="text-xs text-gray-400">@{a.username}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">{t('profile.memberSince')}: {formatDate(branch.created_at)}</p>
              </div>
            </div>

            {/* Teachers */}
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('branches.teachers')} ({teachers.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {teachers.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
                ) : (
                  teachers.map(tc => (
                    <Link
                      key={tc.id}
                      href={`/users/${tc.id}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <Avatar firstName={tc.first_name} lastName={tc.last_name} avatarUrl={tc.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tc.first_name} {tc.last_name}</p>
                        <p className="text-xs text-gray-400 truncate">@{tc.username}{tc.direction_name ? ` · ${tc.direction_name}` : ''}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        {tc.group_count} {t('branches.groups')}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Modal */}
      {logoModalOpen && branch.logo_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setLogoModalOpen(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(branch.logo_url) || ''}
              alt={branch.name}
              className="w-full h-full object-contain max-h-[85vh] max-w-[85vw]"
            />
            <button
              onClick={() => setLogoModalOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors flex items-center justify-center text-2xl"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}