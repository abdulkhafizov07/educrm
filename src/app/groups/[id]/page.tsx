'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import { formatTime, formatDate, getDayName, cn } from '@/lib/utils';
import { downloadFile } from '@/lib/download';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GroupDetail {
  id: string; name: string; branch_name: string; teacher_name: string | null;
  teacher_user_id: string | null; teacher_first_name: string | null; teacher_last_name: string | null;
  teacher_avatar_url: string | null; teacher_phone: string | null; teacher_email: string | null;
  student_count: string; max_students: number; is_active: boolean; description: string | null; start_date: string | null;
  students: Array<{ id: string; first_name: string; last_name: string; username: string; avatar_url: string | null }>;
  schedules: Array<{ id: string; day_of_week: number; start_time: string; end_time: string; classroom: string | null }>;
  attendanceToday?: { total: string; present_count: string; absent_count: string; late_count: string };
  attendanceTrend?: Array<{ session_date: string; present_count: string; absent_count: string; late_count: string; total: string }>;
  stats?: { sessions: number; attendancePct: number };
}

interface Student { id: string; first_name: string; last_name: string; username: string; avatar_url: string | null; }

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_admin';
  const canTakeAttendance = user?.role === 'teacher' || user?.role === 'super_admin' || user?.role === 'branch_admin';

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile(`/api/attendance/export?group_id=${id}&date=${exportDate}`, `attendance-${exportDate}.xlsx`);
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setExporting(false); }
  };

  const fetchGroup = async () => {
    setLoading(true);
    try {
      const data = await api.get<GroupDetail>(`/api/groups/${id}`);
      setGroup(data);
    } catch { toast(t('errors.notFound'), 'error'); router.back(); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroup(); }, [id]);

  const openAddStudent = async () => {
    const enrolled = group?.students.map(s => s.id) || [];
    const data = await api.get<{ data: Student[] }>('/api/users', { role: 'student', limit: 500 });
    setAvailableStudents(data.data.filter(s => !enrolled.includes(s.id)));
    setSelectedIds([]);
    setStudentSearch('');
    setAddStudentOpen(true);
  };

  const toggleSelect = (sid: string) => {
    setSelectedIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
  };

  const handleAddStudents = async () => {
    if (!selectedIds.length) return;
    setAdding(true);
    try {
      await api.post(`/api/groups/${id}/students`, { student_ids: selectedIds });
      toast(t('groups.studentsAdded'), 'success');
      setAddStudentOpen(false);
      fetchGroup();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setAdding(false); }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      await api.delete(`/api/groups/${id}/students/${studentId}`);
      toast('Student removed', 'success');
      fetchGroup();
    } catch (err) { toast((err as Error).message, 'error'); }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  if (!group) return null;

  const filteredStudents = availableStudents.filter(s => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
  });

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

        {/* Group Info Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  {group.name}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {group.branch_name}
                </div>
              </div>
              <Badge variant={group.is_active ? 'success' : 'default'} className="text-sm px-3 py-1">
                {group.is_active ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>

            {/* Stats - dashboard-style tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('groups.teacher')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {group.teacher_name || '—'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('groups.capacity')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {group.students.length}/{group.max_students}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('groups.startDate')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                  {formatDate(group.start_date)}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('users.totalSessions')}</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                  {group.stats?.sessions ?? 0}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.attendanceRate')}</p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-0.5">
                  {group.stats?.attendancePct ?? 0}%
                </p>
              </div>
            </div>

            {/* Actions */}
            {canTakeAttendance && (
              <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <Link href={`/attendance/group/${id}`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {t('attendance.register')}
                  </Button>
                </Link>

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date"
                    value={exportDate}
                    onChange={e => setExportDate(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition"
                  />
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
              </div>
            )}
          </div>
        </div>

        {/* O'qituvchi profili — bosilsa o'qituvchining profil sahifasi ochiladi */}
        {group.teacher_user_id && (
          <Link href={`/users/${group.teacher_user_id}`} className="block group/teacher">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <Avatar
                firstName={group.teacher_first_name || (group.teacher_name || '').split(' ')[0] || ''}
                lastName={group.teacher_last_name || (group.teacher_name || '').split(' ')[1] || ''}
                avatarUrl={group.teacher_avatar_url}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('groups.teacher')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover/teacher:text-blue-600 dark:group-hover/teacher:text-blue-400 transition-colors">
                  {group.teacher_name}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                  {group.teacher_phone && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {group.teacher_phone}
                    </span>
                  )}
                  {group.teacher_email && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {group.teacher_email}
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover/teacher:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* Attendance charts — same as the dashboard, scoped to this group only */}
        <AttendanceOverview attendanceToday={group.attendanceToday} attendanceTrend={group.attendanceTrend} />

        {/* Schedule */}
        {group.schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('schedule.title')}</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.schedules.map(s => (
                <div key={s.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800/30">
                  <div className="font-medium text-blue-700 dark:text-blue-300">{getDayName(s.day_of_week, t)}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">{formatTime(s.start_time)} — {formatTime(s.end_time)}</div>
                  {s.classroom && <div className="text-xs text-gray-400 mt-1 flex"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-door-open" viewBox="0 0 16 16">
                    <path d="M8.5 10c-.276 0-.5-.448-.5-1s.224-1 .5-1 .5.448.5 1-.224 1-.5 1" />
                    <path d="M10.828.122A.5.5 0 0 1 11 .5V1h.5A1.5 1.5 0 0 1 13 2.5V15h1.5a.5.5 0 0 1 0 1h-13a.5.5 0 0 1 0-1H3V1.5a.5.5 0 0 1 .43-.495l7-1a.5.5 0 0 1 .398.117M11.5 2H11v13h1V2.5a.5.5 0 0 0-.5-.5M4 1.934V15h6V1.077z" />
                  </svg>  {s.classroom}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Students */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('groups.enrolledStudents')} ({group.students.length})
              </h2>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={openAddStudent}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('groups.addStudent')}
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {group.students.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>{t('common.noData')}</span>
              </div>
            ) : (
              group.students.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-gray-400">@{s.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/users/${s.id}`}>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </Link>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStudent(s.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add students modal — search + multi-select */}
      <Modal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} title={t('groups.addStudent')} size="lg">
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder={t('common.search')}
            autoFocus
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>

        <div className="max-h-80 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded divide-y divide-gray-100 dark:divide-gray-800">
          {filteredStudents.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">{t('common.noData')}</div>
          ) : (
            filteredStudents.map(s => {
              const checked = selectedIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSelect(s.id)}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50')}
                >
                  <span className={cn('w-5 h-5 rounded border flex items-center justify-center shrink-0',
                    checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600')}>
                    {checked && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </span>
                  <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-gray-400 truncate">@{s.username}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">{selectedIds.length} {t('common.selected')}</span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setAddStudentOpen(false)} disabled={adding}>{t('common.cancel')}</Button>
            <Button onClick={handleAddStudents} loading={adding} disabled={!selectedIds.length} className="bg-blue-600 hover:bg-blue-700 text-white">
              {t('common.add')}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}