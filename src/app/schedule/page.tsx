'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatTime, getDayName } from '@/lib/utils';

interface Schedule {
  id: string; group_id: string; group_name: string; branch_name: string; teacher_name: string;
  day_of_week: number; start_time: string; end_time: string; classroom: string | null;
}
interface Group { id: string; name: string; }

const DAYS = [1, 2, 3, 4, 5, 6, 0];

export default function SchedulePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ group_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:30', classroom: '' });
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_admin';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Schedule[]>('/api/schedules');
      setSchedules(data);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (canEdit) {
      api.get<{ data: Group[] }>('/api/groups', { limit: 100 }).then(d => setGroups(d.data)).catch(() => {});
    }
  }, [canEdit]);

  const openCreate = () => {
    setEditing(null);
    setForm({ group_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:30', classroom: '' });
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({ group_id: s.group_id, day_of_week: s.day_of_week, start_time: s.start_time.substring(0, 5), end_time: s.end_time.substring(0, 5), classroom: s.classroom || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.group_id || !form.start_time || !form.end_time) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/schedules/${editing.id}`, form);
      } else {
        await api.post('/api/schedules', form);
      }
      toast(t('common.success'), 'success');
      setModalOpen(false);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/schedules/${deleteTarget.id}`);
      toast(t('common.success'), 'success');
      setDeleteTarget(null);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  };

  // Group by day
  const byDay = DAYS.map(day => ({
    day,
    items: schedules.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter(d => d.items.length > 0 || canEdit);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('schedule.title')}</h1>
          {canEdit && (
            <Button onClick={openCreate}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('schedule.addSchedule')}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {byDay.filter(d => d.items.length > 0).map(({ day, items }) => (
              <div key={day} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{getDayName(day, t)}</h3>
                </div>
                <div className="p-3 space-y-2">
                  {items.map(s => (
                    <div key={s.id} className="bg-indigo-50 dark:bg-indigo-900/20 rounded p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">{s.group_name}</p>
                          <p className="text-xs text-indigo-500 dark:text-indigo-400">
                            {formatTime(s.start_time)} — {formatTime(s.end_time)}
                          </p>
                          {s.teacher_name && <p className="text-xs text-gray-400 truncate">{s.teacher_name}</p>}
                          {s.classroom && <p className="text-xs text-gray-400">{s.classroom}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 ml-2">
                            <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-indigo-600 p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteTarget(s)} className="text-gray-400 hover:text-red-500 p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('schedule.editSchedule') : t('schedule.addSchedule')}>
        <div className="space-y-4">
          {!editing && (
            <Select
              label={t('nav.groups')}
              value={form.group_id}
              onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}
              placeholder="Select group"
              options={groups.map(g => ({ value: g.id, label: g.name }))}
              required
            />
          )}
          <Select
            label={t('schedule.dayOfWeek')}
            value={String(form.day_of_week)}
            onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
            options={[1,2,3,4,5,6,0].map(d => ({ value: String(d), label: getDayName(d, t) }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('schedule.startTime')} type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            <Input label={t('schedule.endTime')} type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Input label={t('schedule.classroom')} value={form.classroom} onChange={e => setForm(f => ({ ...f, classroom: e.target.value }))} />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('schedule.deleteSchedule')}
        message="Are you sure you want to delete this schedule?"
        loading={deleting}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </DashboardLayout>
  );
}
