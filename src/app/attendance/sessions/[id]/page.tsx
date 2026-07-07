'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { formatDate, formatTime, getAttendanceColor } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface SessionDetail {
  id: string; group_name: string; teacher_name: string; session_date: string; start_time: string; notes: string | null;
  records: Array<{
    id: string; student_id: string; student_name: string; username: string; avatar_url: string | null;
    status: string; arrival_time: string | null; late_minutes: number;
  }>;
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SessionDetail>(`/api/attendance/sessions/${id}`)
      .then(setSession)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

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

  if (!session) return null;

  const stats = {
    total: session.records.length,
    present: session.records.filter(r => r.status === 'present').length,
    absent: session.records.filter(r => r.status === 'absent').length,
    late: session.records.filter(r => r.status === 'late').length,
  };
  const pct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;

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

        {/* Session info card with accent bar */}
        <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r" />
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg text-blue-600 dark:text-blue-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  {session.group_name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(session.session_date)} · {formatTime(session.start_time)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {session.teacher_name}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  {stats.total} {t('branches.students')}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.present}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('attendance.present')}</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.late}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('attendance.late')}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.absent}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('attendance.absent')}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{pct}%</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('attendance.attendanceRate')}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(stats.present / stats.total) * 100}%` }} />
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${(stats.late / stats.total) * 100}%`, marginLeft: `${(stats.present / stats.total) * 100}%` }} />
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.absent / stats.total) * 100}%`, marginLeft: `${((stats.present + stats.late) / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Students list */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('attendance.studentsList')} ({stats.total})
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {session.records.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{t('common.noData')}</span>
              </div>
            ) : (
              session.records.map((rec, i) => (
                <div
                  key={rec.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <Avatar
                      firstName={rec.student_name.split(' ')[0]}
                      lastName={rec.student_name.split(' ')[1] || ''}
                      avatarUrl={rec.avatar_url}
                      size="sm"
                      className="ring-2 ring-gray-100 dark:ring-gray-700"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {rec.student_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">@{rec.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {rec.status === 'late' && rec.late_minutes > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('attendance.lateBy')} {rec.late_minutes} {t('attendance.minutes')}
                      </span>
                    )}
                    {rec.arrival_time && rec.status !== 'absent' && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatTime(rec.arrival_time)}
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
      </div>
    </DashboardLayout>
  );
}