'use client';
import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatTime, getDayName } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GroupDetail {
  id: string; name: string; branch_name: string; teacher_name: string | null;
  student_count: string; max_students: number; is_active: boolean; description: string | null;
  students: Array<{ id: string; first_name: string; last_name: string; username: string; avatar_url: string | null }>;
  schedules: Array<{ id: string; day_of_week: number; start_time: string; end_time: string; classroom: string | null }>;
}

interface Student { id: string; first_name: string; last_name: string; username: string; }

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
  const [selectedStudent, setSelectedStudent] = useState('');
  const [adding, setAdding] = useState(false);

  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_admin';

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
    const data = await api.get<{ data: Student[] }>('/api/users', { role: 'student', limit: 200 });
    setAvailableStudents(data.data.filter(s => !enrolled.includes(s.id)));
    setSelectedStudent('');
    setAddStudentOpen(true);
  };

  const handleAddStudent = async () => {
    if (!selectedStudent) return;
    setAdding(true);
    try {
      await api.post(`/api/groups/${id}/students`, { student_id: selectedStudent });
      toast(t('groups.addStudent') + ' successful', 'success');
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
          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  if (!group) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('common.back')}
        </Button>

        {/* Group info */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{group.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{group.branch_name}</p>
            </div>
            <Badge variant={group.is_active ? 'success' : 'default'}>
              {group.is_active ? t('common.active') : t('common.inactive')}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400">{t('groups.teacher')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{group.teacher_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('groups.capacity')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{group.students.length}/{group.max_students}</p>
            </div>
          </div>

          {/* Teacher action: take attendance */}
          {(user?.role === 'teacher' || user?.role === 'super_admin' || user?.role === 'branch_admin') && (
            <div className="mt-4 flex gap-2">
              <Link href={`/attendance/take?group=${id}`}>
                <Button size="sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  {t('attendance.takeAttendance')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Schedule */}
        {group.schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('schedule.title')}</h2>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {group.schedules.map(s => (
                <div key={s.id} className="bg-indigo-50 dark:bg-indigo-900/20 rounded px-3 py-2 text-sm">
                  <div className="font-medium text-indigo-700 dark:text-indigo-300">{getDayName(s.day_of_week, t)}</div>
                  <div className="text-indigo-600 dark:text-indigo-400">{formatTime(s.start_time)} — {formatTime(s.end_time)}</div>
                  {s.classroom && <div className="text-xs text-gray-400">{s.classroom}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Students */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('groups.enrolledStudents')} ({group.students.length})
            </h2>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openAddStudent}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('groups.addStudent')}
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {group.students.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">{t('common.noData')}</div>
            ) : (
              group.students.map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={s.first_name} lastName={s.last_name} avatarUrl={s.avatar_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-gray-400">@{s.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/users/${s.id}`}>
                      <Button variant="ghost" size="sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </Link>
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleRemoveStudent(s.id)}>
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

      {/* Add student modal */}
      <Modal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} title={t('groups.addStudent')} size="sm">
        <Select
          label={t('nav.students')}
          value={selectedStudent}
          onChange={e => setSelectedStudent(e.target.value)}
          placeholder="Select a student"
          options={availableStudents.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name} (@${s.username})` }))}
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => setAddStudentOpen(false)} disabled={adding}>{t('common.cancel')}</Button>
          <Button onClick={handleAddStudent} loading={adding} disabled={!selectedStudent}>{t('common.add')}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
