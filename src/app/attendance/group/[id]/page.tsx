'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type Status = 'present' | 'late' | 'absent';

interface Student { id: string; first_name: string; last_name: string; username: string; avatar_url: string | null; }
interface CellData { status: Status; late_minutes: number; grade?: number | null; }
interface GridData {
  year: number; month: number;
  students: Student[];
  dates: string[];
  records: Record<string, Record<string, CellData>>;
  examDates: string[];
  startByDay: Record<string, string>;
}
interface OverviewStudent extends Student { total: number; present: number; absent: number; late: number; }
interface OverviewData { from_date: string; to_date: string; total_sessions: number; students: OverviewStudent[]; }

const NEXT: Record<Status, Status> = { present: 'late', late: 'absent', absent: 'present' };
const cellFill: Record<Status, string> = {
  present: 'bg-green-500 text-white',
  late: 'bg-amber-500 text-white',
  absent: 'bg-red-500 text-white',
};
const cellChar: Record<Status, string> = { present: '✓', late: 'K', absent: '✕' };
const legendDot: Record<Status, string> = { present: 'bg-green-500', late: 'bg-amber-500', absent: 'bg-red-500' };

function monthShift(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => fmt(new Date());

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState<GridData | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [examDates, setExamDates] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [view, setView] = useState<'grid' | 'overview'>('grid');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewFrom, setOverviewFrom] = useState('');
  const [overviewTo, setOverviewTo] = useState('');

  const [exportDate, setExportDate] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US';

  const fetchGrid = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
      const d = await api.get<GridData>('/api/attendance/grid', { group_id: id, month: monthStr });
      setData(d);
      setColumns(d.dates);
      setExamDates(d.examDates || []);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [id, ym, toast]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  useEffect(() => {
    api.get<{ name: string }>(`/api/groups/${id}`).then(g => setGroupName(g.name)).catch(() => {});
  }, [id]);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const d = await api.get<OverviewData>('/api/attendance/overview', {
        group_id: id, from_date: overviewFrom || undefined, to_date: overviewTo || undefined,
      });
      setOverview(d);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setOverviewLoading(false); }
  }, [id, overviewFrom, overviewTo, toast]);

  useEffect(() => { if (view === 'overview') fetchOverview(); }, [view, fetchOverview]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile(`/api/attendance/export?group_id=${id}&date=${exportDate}`, `attendance-${exportDate}.xlsx`);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setExporting(false); }
  };

  // ----- Date column management (fixed order & deduplication) -----
  const addColumn = () => {
    setColumns(cols => {
      const set = new Set(cols);
      let dt = new Date();
      let newDate = fmt(dt);
      while (set.has(newDate)) {
        dt.setDate(dt.getDate() + 1);
        newDate = fmt(dt);
      }
      return [...cols, newDate].sort();
    });
  };

  const changeColumn = (idx: number, value: string) => {
    if (!value) return;
    setColumns(cols => {
      const newCols = [...cols];
      newCols[idx] = value;
      // Deduplicate preserving first occurrence order
      const seen = new Set<string>();
      const result: string[] = [];
      for (const d of newCols) {
        if (!seen.has(d)) {
          seen.add(d);
          result.push(d);
        }
      }
      return result.sort();
    });
  };

  const removeColumn = (idx: number) => {
    setColumns(cols => cols.filter((_, i) => i !== idx));
  };

  const cycle = async (date: string, studentId: string) => {
    if (!data) return;
    const cur = data.records[date]?.[studentId]?.status;
    const next: Status = cur ? NEXT[cur] : 'present';
    const key = `${date}_${studentId}`;
    setSaving(key);
    setData(prev => {
      if (!prev) return prev;
      const records = {
        ...prev.records,
        [date]: {
          ...(prev.records[date] || {}),
          [studentId]: { status: next, late_minutes: 0 },
        },
      };
      return { ...prev, records };
    });
    try {
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      await api.post('/api/attendance/mark', {
        group_id: id,
        session_date: date,
        student_id: studentId,
        status: next,
        start_time: data.startByDay[dow] || '00:00',
      });
    } catch (err) {
      toast((err as Error).message, 'error');
      fetchGrid();
    } finally {
      setSaving(null);
    }
  };

  const isExam = (date: string) => examDates.includes(date);

  // Toggle a date column between a normal attendance day and an exam (graded) day
  const toggleExam = async (date: string) => {
    const next = !isExam(date);
    setExamDates(prev => (next ? [...prev, date] : prev.filter(d => d !== date)));
    try {
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      await api.post('/api/attendance/exam', {
        group_id: id,
        session_date: date,
        is_exam: next,
        start_time: data?.startByDay[dow] || '00:00',
      });
    } catch (err) {
      toast((err as Error).message, 'error');
      fetchGrid();
    }
  };

  // Local (optimistic) grade edit while typing
  const updateGradeLocal = (date: string, studentId: string, value: string) => {
    const num = value === '' ? null : Math.max(0, Math.min(100, parseInt(value) || 0));
    setData(prev => {
      if (!prev) return prev;
      const prevCell = prev.records[date]?.[studentId];
      const records = {
        ...prev.records,
        [date]: {
          ...(prev.records[date] || {}),
          [studentId]: { status: 'present' as Status, late_minutes: prevCell?.late_minutes || 0, grade: num },
        },
      };
      return { ...prev, records };
    });
  };

  // Persist a grade on blur
  const saveGrade = async (date: string, studentId: string, value: string) => {
    const num = value === '' ? null : Math.max(0, Math.min(100, parseInt(value) || 0));
    try {
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      await api.post('/api/attendance/grade', {
        group_id: id,
        session_date: date,
        student_id: studentId,
        grade: num,
        start_time: data?.startByDay[dow] || '00:00',
      });
    } catch (err) {
      toast((err as Error).message, 'error');
      fetchGrid();
    }
  };

  const monthLabel = new Date(ym.y, ym.m - 1, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  const today = todayStr();

  const summary = (studentId: string) => {
    let present = 0,
      late = 0,
      absent = 0;
    for (const d of columns) {
      if (isExam(d)) continue;
      const s = data?.records[d]?.[studentId]?.status;
      if (s === 'present') present++;
      else if (s === 'late') late++;
      else if (s === 'absent') absent++;
    }
    return { present, late, absent };
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('common.back')}
          </Button>
          {view === 'grid' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setYm(p => monthShift(p.y, p.m, -1))} title={t('attendance.prevMonth')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[130px] text-center capitalize">{monthLabel}</span>
              <Button variant="outline" size="sm" onClick={() => setYm(p => monthShift(p.y, p.m, 1))} title={t('attendance.nextMonth')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('attendance.register')}</h1>
            {groupName && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{groupName}</p>}
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('attendance.selectDate')}</label>
              <input
                type="date"
                value={exportDate}
                onChange={e => setExportDate(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              loading={exporting}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('attendance.exportExcel')}
            </Button>
          </div>

          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => setView('grid')}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'grid' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}
            >
              {t('attendance.monthlyView')}
            </button>
            <button
              onClick={() => setView('overview')}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'overview' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}
            >
              {t('attendance.overviewView')}
            </button>
          </div>

          {view === 'grid' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(['present', 'late', 'absent'] as Status[]).map(s => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn('w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-bold text-white', legendDot[s])}>
                  {cellChar[s]}
                </span>
                <span className="text-gray-600 dark:text-gray-300">{t(`attendance.${s}`)}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-bold text-white bg-purple-500">T</span>
              <span className="text-gray-600 dark:text-gray-300">{t('attendance.exam')}</span>
            </span>
          </div>
          )}
        </div>

        {view === 'overview' ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('attendance.overview')}</h2>
                {overview && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(overview.from_date)} — {formatDate(overview.to_date)} · {overview.total_sessions} {t('attendance.totalSessions')}
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('users.dateFrom')}</label>
                  <input type="date" value={overviewFrom} onChange={e => setOverviewFrom(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('users.dateTo')}</label>
                  <input type="date" value={overviewTo} onChange={e => setOverviewTo(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>
            </div>

            {overviewLoading ? (
              <div className="p-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
            ) : !overview || overview.students.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">{t('attendance.noStudents')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2 font-medium">{t('branches.students')}</th>
                    <th className="px-4 py-2 font-medium text-center">{t('attendance.totalSessions')}</th>
                    <th className="px-4 py-2 font-medium text-center">{t('attendance.present')}</th>
                    <th className="px-4 py-2 font-medium text-center">{t('attendance.absent')}</th>
                    <th className="px-4 py-2 font-medium text-center">{t('attendance.late')}</th>
                    <th className="px-4 py-2 font-medium text-center">{t('attendance.attendanceRate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {overview.students.map(s => {
                    const pct = s.total ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white leading-tight">{s.first_name} {s.last_name}</div>
                              <div className="text-xs text-gray-400">@{s.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{s.total}</td>
                        <td className="px-4 py-2.5 text-center text-green-600 dark:text-green-400 font-semibold">{s.present}</td>
                        <td className="px-4 py-2.5 text-center text-red-600 dark:text-red-400 font-bold">{s.absent}</td>
                        <td className="px-4 py-2.5 text-center text-amber-600 dark:text-amber-400 font-semibold">{s.late}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 animate-pulse h-72" />
        ) : !data || data.students.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center text-sm text-gray-400">
            {t('attendance.noStudents')}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table className="border-collapse text-sm w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 min-w-[210px]">
                    {t('branches.students')}
                  </th>
                  {columns.map((d, i) => {
                    const isToday = d === today;
                    const exam = isExam(d);
                    const dt = new Date(d + 'T00:00:00');
                    const wd = dt.toLocaleDateString(dateLocale, { weekday: 'short' });
                    const day = dt.getDate();
                    return (
                      <th key={i} className={cn(
                        'relative group w-14 min-w-[56px] h-14 px-0 py-1 text-center font-medium border border-gray-200 dark:border-gray-700',
                        isToday ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : exam ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
                      )}>
                        <div className="text-[10px] uppercase leading-tight opacity-70">{wd}</div>
                        <div className="text-sm font-semibold leading-tight">{day}</div>
                        {exam ? (
                          <div className="text-[8px] font-bold uppercase leading-tight mt-0.5 truncate px-0.5">{t('attendance.exam')}</div>
                        ) : (
                          <svg className="w-3 h-3 mx-auto mt-0.5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        <input
                          type="date"
                          value={d}
                          onChange={e => changeColumn(i, e.target.value)}
                          onClick={e => e.currentTarget.showPicker?.()}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title={d}
                        />
                        <button
                          onClick={() => toggleExam(d)}
                          title={t('attendance.markExam')}
                          className={cn('absolute top-0 left-0 z-20 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-sm',
                            exam ? 'text-purple-700 dark:text-purple-300' : 'text-gray-300 hover:text-purple-500 opacity-0 group-hover:opacity-100')}
                        >
                          T
                        </button>
                        <button
                          onClick={() => removeColumn(i)}
                          className="absolute -top-0 right-0 z-20 w-4 h-4 flex items-center justify-center text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-12 min-w-[48px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0">
                    <button
                      onClick={addColumn}
                      title={t('attendance.selectDate')}
                      className="w-full h-14 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 whitespace-nowrap">
                    {t('attendance.marked')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => {
                  const sum = summary(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2.5">
                          <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate leading-tight">
                              {s.first_name} {s.last_name}
                            </div>
                            <div className="text-xs text-gray-400 truncate">@{s.username}</div>
                          </div>
                        </div>
                      </td>
                      {columns.map((d, i) => {
                        const cell = data.records[d]?.[s.id];
                        const key = `${d}_${s.id}`;
                        const exam = isExam(d);
                        return (
                          <td key={i} className="p-0 border border-gray-200 dark:border-gray-700 text-center">
                            {exam ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={cell?.grade ?? ''}
                                onChange={e => updateGradeLocal(d, s.id, e.target.value)}
                                onBlur={e => saveGrade(d, s.id, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                placeholder="—"
                                className="w-14 h-14 text-center text-sm font-bold bg-transparent text-purple-700 dark:text-purple-300 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:bg-purple-50 dark:focus:bg-purple-900/20 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            ) : (
                              <button
                                onClick={() => cycle(d, s.id)}
                                disabled={saving === key}
                                className={cn(
                                  'w-14 h-14 text-base font-bold flex items-center justify-center mx-auto transition-colors',
                                  cell?.status ? cellFill[cell.status] : 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
                                  saving === key && 'opacity-50'
                                )}
                              >
                                {cell?.status ? cellChar[cell.status] : ''}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-gray-200 dark:border-gray-700" />
                      <td className="px-3 py-2 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                        <span className="text-green-600 dark:text-green-400 font-semibold">{sum.present}</span>
                        <span className="text-gray-300 dark:text-gray-600"> · </span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">{sum.late}</span>
                        <span className="text-gray-300 dark:text-gray-600"> · </span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">{sum.absent}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && (
          <p className="text-xs text-gray-400">{t('attendance.legend')} · {t('attendance.examHint')}</p>
        )}
      </div>
    </DashboardLayout>
  );
}