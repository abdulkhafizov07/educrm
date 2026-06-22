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
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
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
      <div className="space-y-5 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{session.group_name}</h1>
          <p className="text-sm text-gray-400">{t('attendance.sessionDate')}: {formatDate(session.session_date)} · {formatTime(session.start_time)}</p>
          <p className="text-sm text-gray-400">{t('groups.teacher')}: {session.teacher_name}</p>
          <div className="flex gap-6 mt-4">
            {[
              { label: t('attendance.present'), val: stats.present, color: 'text-green-600' },
              { label: t('attendance.absent'), val: stats.absent, color: 'text-red-600' },
              { label: t('attendance.late'), val: stats.late, color: 'text-amber-600' },
              { label: t('attendance.attendanceRate'), val: `${pct}%`, color: 'text-indigo-600' },
            ].map((s, i) => (
              <div key={i}>
                <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {session.records.map((rec, i) => (
              <div key={rec.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <Avatar firstName={rec.student_name.split(' ')[0]} lastName={rec.student_name.split(' ')[1] || ''} avatarUrl={rec.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{rec.student_name}</p>
                    <p className="text-xs text-gray-400">@{rec.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rec.status === 'late' && rec.late_minutes > 0 && (
                    <span className="text-xs text-amber-600">{t('attendance.lateBy')} {rec.late_minutes} {t('attendance.minutes')}</span>
                  )}
                  {rec.arrival_time && rec.status !== 'absent' && (
                    <span className="text-xs text-gray-400">{formatTime(rec.arrival_time)}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAttendanceColor(rec.status)}`}>
                    {t(`attendance.${rec.status}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
