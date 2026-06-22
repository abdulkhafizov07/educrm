'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Session {
  id: string; group_id: string; group_name: string; branch_name: string;
  teacher_name: string; session_date: string; start_time: string;
  present_count: string; absent_count: string; late_count: string; total_records: string;
}

export default function AttendancePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Session[]; total: number; pages: number }>(
        '/api/attendance/sessions',
        { from_date: fromDate || undefined, to_date: toDate || undefined, page, limit }
      );
      setSessions(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [fromDate, toDate, page, limit, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const canTake = user?.role === 'teacher' || user?.role === 'super_admin' || user?.role === 'branch_admin';

  const getAttPct = (s: Session) => {
    const total = parseInt(s.total_records);
    if (!total) return 0;
    return Math.round(((parseInt(s.present_count) + parseInt(s.late_count)) / total) * 100);
  };

  const columns = [
    { key: 'session_date', header: t('attendance.sessionDate'), render: (s: Session) => (
      <span className="font-medium text-gray-900 dark:text-white">{formatDate(s.session_date)}</span>
    )},
    { key: 'group_name', header: t('groups.groupName'), render: (s: Session) => (
      <Link href={`/groups/${s.group_id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{s.group_name}</Link>
    )},
    { key: 'branch_name', header: t('common.branch'), render: (s: Session) => <span>{s.branch_name}</span> },
    { key: 'teacher_name', header: t('groups.teacher'), render: (s: Session) => <span>{s.teacher_name}</span> },
    { key: 'stats', header: t('common.status'), render: (s: Session) => (
      <div className="flex gap-2">
        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{s.present_count} P</span>
        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{s.absent_count} A</span>
        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{s.late_count} L</span>
      </div>
    )},
    { key: 'pct', header: t('attendance.attendanceRate'), render: (s: Session) => {
      const pct = getAttPct(s);
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300">{pct}%</span>
        </div>
      );
    }},
    { key: 'actions', header: '', render: (s: Session) => (
      <Link href={`/attendance/sessions/${s.id}`}>
        <Button variant="ghost" size="sm">{t('common.view')}</Button>
      </Link>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('attendance.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} sessions</p>
          </div>
          {canTake && (
            <Link href="/attendance/take">
              <Button>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('attendance.takeAttendance')}
              </Button>
            </Link>
          )}
        </div>

        {/* Date filters */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {(fromDate || toDate) && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}>
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={sessions} loading={loading} getKey={s => s.id} emptyMessage={t('attendance.noSessions')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>
    </DashboardLayout>
  );
}
