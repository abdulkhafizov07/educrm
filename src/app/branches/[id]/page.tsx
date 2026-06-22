'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BranchDetail {
  id: string; name: string; address: string | null; phone: string | null; email: string | null;
  is_active: boolean; created_at: string;
  teacher_count: string; student_count: string; admin_count: string; group_count: string;
  groups: Array<{ id: string; name: string; max_students: number; is_active: boolean; teacher_name: string | null; student_count: string }>;
  admins: Array<{ id: string; first_name: string; last_name: string; username: string; avatar_url: string | null }>;
}

const StudentsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
);
const TeachersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const GroupsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BranchDetail>(`/api/branches/${id}`)
      .then(setBranch)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

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

  if (!branch) return null;

  const statCards = [
    { label: t('branches.students'), value: branch.student_count, icon: <StudentsIcon />, color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { label: t('branches.teachers'), value: branch.teacher_count, icon: <TeachersIcon />, color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    { label: t('branches.groups'), value: branch.group_count, icon: <GroupsIcon />, color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    { label: t('users.roles.branch_admin'), value: branch.admin_count, icon: <AdminIcon />, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        {/* Branch header */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{branch.name}</h1>
                {branch.address && <p className="text-sm text-gray-400 mt-0.5">{branch.address}</p>}
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {branch.phone && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {branch.phone}
                    </span>
                  )}
                  {branch.email && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {branch.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge variant={branch.is_active ? 'success' : 'default'}>
              {branch.is_active ? t('common.active') : t('common.inactive')}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded flex items-center justify-center ${s.color}`}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups list */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('branches.groups')} ({branch.groups.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {branch.groups.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
              ) : (
                branch.groups.map(g => (
                  <Link key={g.id} href={`/groups/${g.id}`}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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

          {/* Branch admins */}
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('users.roles.branch_admin')}</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {branch.admins.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
              ) : (
                branch.admins.map(a => (
                  <Link key={a.id} href={`/users/${a.id}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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
        </div>
      </div>
    </DashboardLayout>
  );
}
