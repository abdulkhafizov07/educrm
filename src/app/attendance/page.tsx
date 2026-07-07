'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GroupSummary {
  id: string; name: string; branch_name: string | null; teacher_name: string | null;
  total_sessions: number; last_session_date: string | null;
  present_count: number; absent_count: number; late_count: number;
}

interface Branch { id: string; name: string; }
interface GroupOption { id: string; name: string; branch_name: string; }

export default function AttendancePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [groups, setGroupsList] = useState<GroupSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [exporting, setExporting] = useState(false);

  // Group picker — opens the attendance register for a chosen group
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGroups, setPickerGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);

  const filterParams = { search: search || undefined, branch_id: branchFilter || undefined };

  const fetchGroups = useCallback(async () => {
    if (user?.role === 'student') { setLoading(false); return; } // students use their own view
    setLoading(true);
    try {
      const data = await api.get<{ data: GroupSummary[]; total: number; pages: number }>(
        '/api/attendance/groups-summary',
        { ...filterParams, page, limit }
      );
      setGroupsList(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchFilter, page, limit, toast, user]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => {
    if (user?.role === 'super_admin') {
      api.get<{ data: Branch[] }>('/api/branches').then(d => setBranches(d.data)).catch(() => {});
    }
  }, [user]);

  const canTake = user?.role === 'teacher' || user?.role === 'super_admin' || user?.role === 'branch_admin';

  const openPicker = async () => {
    setPickerOpen(true);
    setSelectedGroup('');
    setLoadingGroups(true);
    try {
      const data = await api.get<{ data: GroupOption[] }>('/api/groups', { is_active: true, limit: 200 });
      setPickerGroups(data.data);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoadingGroups(false); }
  };

  const goToRegister = () => {
    if (!selectedGroup) return;
    setPickerOpen(false);
    router.push(`/attendance/group/${selectedGroup}`);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(filterParams).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString();
      await downloadFile(`/api/attendance/groups-summary/export${qs ? `?${qs}` : ''}`, `attendance-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setExporting(false); }
  };

  const getAttPct = (g: GroupSummary) => {
    if (!g.total_sessions) return 0;
    return Math.round(((g.present_count + g.late_count) / g.total_sessions) * 100);
  };

  const columns = [
    { key: 'group_name', header: t('groups.groupName'), render: (g: GroupSummary) => (
      <Link href={`/attendance/group/${g.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{g.name}</Link>
    )},
    { key: 'branch_name', header: t('common.branch'), render: (g: GroupSummary) => <span>{g.branch_name || '—'}</span> },
    { key: 'teacher_name', header: t('groups.teacher'), render: (g: GroupSummary) => <span>{g.teacher_name?.trim() || '—'}</span> },
    { key: 'total_sessions', header: t('attendance.totalSessions'), render: (g: GroupSummary) => <span className="text-gray-500">{g.total_sessions}</span> },
    { key: 'last_session_date', header: t('attendance.lastSession'), render: (g: GroupSummary) => <span className="text-gray-500 text-xs">{g.last_session_date ? formatDate(g.last_session_date) : '—'}</span> },
    { key: 'stats', header: t('common.status'), render: (g: GroupSummary) => (
      <div className="flex gap-2">
        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{g.present_count} P</span>
        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{g.absent_count} A</span>
        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{g.late_count} L</span>
      </div>
    )},
    { key: 'pct', header: t('attendance.attendanceRate'), render: (g: GroupSummary) => {
      const pct = getAttPct(g);
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300">{pct}%</span>
        </div>
      );
    }},
    { key: 'actions', header: '', render: (g: GroupSummary) => (
      <Link href={`/attendance/group/${g.id}`}>
        <Button variant="ghost" size="sm">{t('common.view')}</Button>
      </Link>
    )},
  ];

  // Students only ever see their own attendance — not the group register
  if (user?.role === 'student') return <StudentAttendanceView userId={user.id} />;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('attendance.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} {t('nav.groups').toLowerCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('attendance.exportExcel')}
            </Button>
            {canTake && (
              <Button onClick={openPicker}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('attendance.takeAttendance')}
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('common.search')}
              className="pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
          {user?.role === 'super_admin' && branches.length > 0 && (
            <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('common.branch')}: {t('common.all')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={groups} loading={loading} getKey={g => g.id} emptyMessage={t('attendance.noSessions')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>

      {/* Group picker — opens the chosen group's attendance register */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('attendance.takeAttendance')} size="sm">
        {loadingGroups ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : pickerGroups.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('attendance.noGroups')}</div>
        ) : (
          <SearchableSelect
            label={t('nav.groups')}
            value={selectedGroup}
            onChange={v => setSelectedGroup(v)}
            placeholder={t('attendance.selectGroup')}
            searchPlaceholder={t('common.search')}
            emptyMessage={t('attendance.noGroups')}
            options={pickerGroups.map(g => ({ value: g.id, label: `${g.name} — ${g.branch_name}` }))}
          />
        )}
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="outline" onClick={() => setPickerOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={goToRegister} disabled={!selectedGroup}>{t('attendance.openRegister')}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// ---- Student's own attendance (no group register, no classmates) ----
interface StudentRec {
  id: string; session_date: string; start_time: string; group_name: string;
  status: string; late_minutes: number; teacher_name: string;
}
function StudentAttendanceView({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [records, setRecords] = useState<StudentRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ records: StudentRec[] }>(`/api/attendance/student/${userId}`)
      .then(d => setRecords(d.records))
      .catch(err => toast((err as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [userId, toast]);

  const statusStyle: Record<string, string> = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('attendance.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('attendance.history')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('attendance.history')}</h2>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.status === 'late' && r.late_minutes > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">+{r.late_minutes} {t('attendance.minutes')}</span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[r.status] || ''}`}>
                      {t(`attendance.${r.status}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
