'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import { calcLateMinutes, getAttendanceColor } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Group { id: string; name: string; }
interface Student { id: string; first_name: string; last_name: string; username: string; avatar_url: string | null; }
interface AttRecord { student_id: string; status: 'present' | 'absent' | 'late'; arrival_time: string; late_minutes: number; }

function TakeAttendanceInner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preGroupId = searchParams.get('group') || '';

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(preGroupId);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [records, setRecords] = useState<Map<string, AttRecord>>(new Map());
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    api.get<{ data: Group[] }>('/api/groups', { limit: 100 }).then(d => setGroups(d.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedGroup) { setStudents([]); setRecords(new Map()); return; }
    setLoadingStudents(true);
    api.get<{ students: Student[] }>(`/api/groups/${selectedGroup}`).then(d => {
      setStudents(d.students);
      const init = new Map<string, AttRecord>();
      d.students.forEach(s => init.set(s.id, { student_id: s.id, status: 'present', arrival_time: startTime, late_minutes: 0 }));
      setRecords(init);
    }).catch(() => {}).finally(() => setLoadingStudents(false));
  }, [selectedGroup]);

  const setStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setRecords(prev => {
      const r = prev.get(studentId) || { student_id: studentId, status: 'present', arrival_time: startTime, late_minutes: 0 };
      const updated = { ...r, status };
      if (status === 'present') { updated.arrival_time = startTime; updated.late_minutes = 0; }
      if (status === 'absent') { updated.arrival_time = ''; updated.late_minutes = 0; }
      return new Map(prev).set(studentId, updated);
    });
  };

  const setArrivalTime = (studentId: string, time: string) => {
    setRecords(prev => {
      const r = prev.get(studentId) || { student_id: studentId, status: 'late', arrival_time: time, late_minutes: 0 };
      const lateMin = calcLateMinutes(startTime, time);
      return new Map(prev).set(studentId, { ...r, arrival_time: time, late_minutes: lateMin });
    });
  };

  const markAll = (status: 'present' | 'absent' | 'late') => {
    const next = new Map<string, AttRecord>();
    students.forEach(s => next.set(s.id, { student_id: s.id, status, arrival_time: startTime, late_minutes: 0 }));
    setRecords(next);
  };

  const handleSave = async () => {
    if (!selectedGroup || !sessionDate || !startTime) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      await api.post('/api/attendance/sessions', {
        group_id: selectedGroup,
        session_date: sessionDate,
        start_time: startTime,
        records: Array.from(records.values()),
      });
      toast(t('attendance.attendanceSaved'), 'success');
      router.push('/attendance');
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const stats = {
    present: Array.from(records.values()).filter(r => r.status === 'present').length,
    absent: Array.from(records.values()).filter(r => r.status === 'absent').length,
    late: Array.from(records.values()).filter(r => r.status === 'late').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('attendance.takeAttendance')}</h1>
        </div>

        {/* Session settings */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t('nav.groups')}
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              placeholder="Select group"
              options={groups.map(g => ({ value: g.id, label: g.name }))}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('attendance.sessionDate')} *</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('attendance.classStart')} *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* Students attendance */}
        {selectedGroup && (
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">{stats.present} {t('attendance.present')}</span>
                <span className="text-red-600">{stats.absent} {t('attendance.absent')}</span>
                <span className="text-amber-600">{stats.late} {t('attendance.late')}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => markAll('present')}>All Present</Button>
                <Button variant="outline" size="sm" onClick={() => markAll('absent')}>All Absent</Button>
              </div>
            </div>

            {loadingStudents ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
            ) : students.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No students in this group</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {students.map((student, idx) => {
                  const rec = records.get(student.id);
                  return (
                    <div key={student.id} className="px-5 py-4 flex items-center gap-4">
                      <span className="text-xs text-gray-400 w-6 text-right shrink-0">{idx + 1}</span>
                      <Avatar firstName={student.first_name} lastName={student.last_name} avatarUrl={student.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-gray-400">@{student.username}</p>
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1">
                        {(['present', 'absent', 'late'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setStatus(student.id, s)}
                            className={cn(
                              'px-3 py-1.5 text-xs font-medium rounded transition-colors border',
                              rec?.status === s
                                ? s === 'present' ? 'bg-green-500 text-white border-green-500'
                                : s === 'absent' ? 'bg-red-500 text-white border-red-500'
                                : 'bg-amber-500 text-white border-amber-500'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            {t(`attendance.${s}`).charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>

                      {/* Late arrival time */}
                      {rec?.status === 'late' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={rec.arrival_time || ''}
                            onChange={e => setArrivalTime(student.id, e.target.value)}
                            className="px-2 py-1 text-sm border border-amber-300 rounded bg-amber-50 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          {rec.late_minutes > 0 && (
                            <span className="text-xs text-amber-600">+{rec.late_minutes}m</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedGroup && students.length > 0 && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('attendance.saveAttendance')}</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function TakeAttendancePage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="py-20 text-center text-gray-400">Loading...</div></DashboardLayout>}>
      <TakeAttendanceInner />
    </Suspense>
  );
}
