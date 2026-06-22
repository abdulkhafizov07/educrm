'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardStats>('/api/dashboard/stats')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = data?.attendanceToday;
  const presentN = parseInt(today?.present_count || '0');
  const absentN = parseInt(today?.absent_count || '0');
  const lateN = parseInt(today?.late_count || '0');
  const totalN = parseInt(today?.total || '0');
  const attendancePct = totalN > 0 ? Math.round(((presentN + lateN) / totalN) * 100) : 0;

  const pieData = [
    { name: t('dashboard.present'), value: presentN },
    { name: t('dashboard.absent'), value: absentN },
    { name: t('dashboard.late'), value: lateN },
  ].filter(d => d.value > 0);

  const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

  const trendData = (data?.attendanceTrend || []).map(d => ({
    date: new Date(d.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    present: parseInt(d.present_count),
    absent: parseInt(d.absent_count),
    late: parseInt(d.late_count),
  }));

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
    if (action.includes('ATTENDANCE')) return { color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', icon: check };
    if (action.includes('PASSWORD')) return { color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', icon: key };
    return { color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: check };
  };

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
              <div key={i} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
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
              color="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            />
            <StatCard
              title={t('dashboard.totalTeachers')}
              value={data?.stats.teachers ?? 0}
              color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            {data?.stats.branches !== null && user?.role === 'super_admin' ? (
              <StatCard
                title={t('dashboard.totalBranches')}
                value={data?.stats.branches ?? 0}
                color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              />
            ) : (
              <StatCard
                title={t('dashboard.attendanceRate')}
                value={`${attendancePct}%`}
                color="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              />
            )}
            <StatCard
              title={t('dashboard.totalGroups')}
              value={data?.stats.groups ?? 0}
              color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's attendance pie */}
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.todayAttendance')}</h2>
            {totalN === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">No sessions today</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, '']} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-2">
                  <span className="text-2xl font-semibold text-gray-900 dark:text-white">{attendancePct}%</span>
                  <span className="text-sm text-gray-400 ml-1">{t('dashboard.attendanceRate')}</span>
                </div>
              </>
            )}
          </div>

          {/* Trend chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.attendanceTrend')}</h2>
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="present" name={t('dashboard.present')} fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="absent" name={t('dashboard.absent')} fill="#ef4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="late" name={t('dashboard.late')} fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
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
