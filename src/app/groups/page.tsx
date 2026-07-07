'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { getDayName, formatDate, cn } from '@/lib/utils';
import Link from 'next/link';

interface Group {
  id: string; name: string; branch_id: string; branch_name: string;
  direction_id: string | null; direction_name: string | null;
  teacher_id: string | null; teacher_name: string | null;
  student_count: string; max_students: number; is_active: boolean; start_date: string | null; created_at: string;
}
interface Branch { id: string; name: string; }
interface Teacher { id: string; first_name: string; last_name: string; }
interface DirectionLite { id: string; name: string; }

interface GroupForm {
  name: string; branch_id: string; direction_id: string; teacher_id: string; description: string; max_students: number; is_active: boolean;
  start_date: string; schedule_days: number[]; start_time: string; end_time: string;
}

const empty: GroupForm = { name: '', branch_id: '', direction_id: '', teacher_id: '', description: '', max_students: 30, is_active: true, start_date: '', schedule_days: [], start_time: '09:00', end_time: '11:00' };

// Mon..Sat, Sun — display order for the weekday picker (DB uses 0=Sun..6=Sat)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Lesson-day presets
const PRESETS: { key: string; days: number[] }[] = [
  { key: 'everyDay', days: [1, 2, 3, 4, 5, 6] }, // Har kuni (Mon–Sat)
  { key: 'mwf', days: [1, 3, 5] },               // Du · Chor · Juma (ora kun)
  { key: 'tts', days: [2, 4, 6] },               // Se · Pay · Sha (ora kun)
];
const sameDays = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export default function GroupsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [directions, setDirections] = useState<DirectionLite[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_admin';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Group[]; total: number; pages: number }>(
        '/api/groups', { search: search || undefined, page, limit }
      );
      setGroups(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [search, page, limit, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (canEdit) {
      if (user?.role === 'super_admin') {
        api.get<{ data: Branch[] }>('/api/branches').then(d => setBranches(d.data)).catch(() => {});
      }
      api.get<{ data: Teacher[] }>('/api/users', { role: 'teacher', limit: 100 }).then(d => setTeachers(d.data)).catch(() => {});
    }
  }, [canEdit, user]);

  // Directions depend on the chosen branch (Branch -> Direction -> Group)
  useEffect(() => {
    if (!canEdit || !form.branch_id) { setDirections([]); return; }
    api.get<{ data: DirectionLite[] }>('/api/directions', { branch_id: form.branch_id })
      .then(d => setDirections(d.data)).catch(() => setDirections([]));
  }, [canEdit, form.branch_id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, branch_id: user?.branch_id || '' });
    setModalOpen(true);
  };
  const openEdit = async (g: Group) => {
    setEditing(g);
    setForm({ name: g.name, branch_id: g.branch_id, direction_id: g.direction_id || '', teacher_id: g.teacher_id || '', description: '', max_students: g.max_students, is_active: g.is_active, start_date: g.start_date ? g.start_date.slice(0, 10) : '', schedule_days: [], start_time: '09:00', end_time: '11:00' });
    setModalOpen(true);
    // Prefill the lesson days/time from the group's existing schedule
    try {
      const detail = await api.get<{ schedules: Array<{ day_of_week: number; start_time: string; end_time: string }> }>(`/api/groups/${g.id}`);
      if (detail.schedules?.length) {
        const days = [...new Set(detail.schedules.map(s => s.day_of_week))];
        setForm(f => ({ ...f, schedule_days: days, start_time: detail.schedules[0].start_time.slice(0, 5), end_time: detail.schedules[0].end_time.slice(0, 5) }));
      }
    } catch { /* schedule is optional */ }
  };

  const toggleDay = (d: number) =>
    setForm(f => ({ ...f, schedule_days: f.schedule_days.includes(d) ? f.schedule_days.filter(x => x !== d) : [...f.schedule_days, d] }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.branch_id) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        teacher_id: form.teacher_id || null,
        branch_id: form.branch_id,
        direction_id: form.direction_id || null,
        start_date: form.start_date || null,
        schedule_days: form.schedule_days,
        start_time: form.start_time,
        end_time: form.end_time,
      };
      if (editing) {
        await api.put(`/api/groups/${editing.id}`, payload);
        toast(t('groups.updated'), 'success');
      } else {
        await api.post('/api/groups', payload);
        toast(t('groups.created'), 'success');
      }
      setModalOpen(false);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/groups/${deleteTarget.id}`);
      toast(t('groups.deleted'), 'success');
      setDeleteTarget(null);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', header: t('groups.groupName'), render: (g: Group) => (
      <Link href={`/groups/${g.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{g.name}</Link>
    )},
    { key: 'branch_name', header: t('common.branch'), render: (g: Group) => <span>{g.branch_name}</span> },
    { key: 'teacher_name', header: t('groups.teacher'), render: (g: Group) => <span>{g.teacher_name || '—'}</span> },
    { key: 'capacity', header: t('groups.capacity'), render: (g: Group) => (
      <span className="text-sm">{g.student_count}/{g.max_students}</span>
    )},
    { key: 'start_date', header: t('groups.startDate'), render: (g: Group) => (
      <span className="text-sm text-gray-500">{formatDate(g.start_date)}</span>
    )},
    { key: 'is_active', header: t('common.status'), render: (g: Group) => (
      <Badge variant={g.is_active ? 'success' : 'default'}>{g.is_active ? t('common.active') : t('common.inactive')}</Badge>
    )},
    { key: 'actions', header: t('common.actions'), render: (g: Group) => (
      <div className="flex gap-1">
        <Link href={`/groups/${g.id}`}>
          <Button variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </Link>
        {canEdit && (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(g)} className="text-red-500 hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('groups.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} {t('common.total').toLowerCase()}</p>
          </div>
          {canEdit && (
            <Button onClick={openCreate}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('groups.addGroup')}
            </Button>
          )}
        </div>

        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={groups} loading={loading} getKey={g => g.id} emptyMessage={t('common.noData')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('groups.editGroup') : t('groups.addGroup')}>
        <div className="space-y-4">
          <Input label={t('groups.groupName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          {user?.role === 'super_admin' && (
            <SearchableSelect
              label={t('common.branch')}
              value={form.branch_id}
              onChange={v => setForm(f => ({ ...f, branch_id: v, direction_id: '' }))}
              placeholder="Select branch"
              searchPlaceholder={t('common.search')}
              emptyMessage={t('common.noData')}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              required
            />
          )}
          {form.branch_id && (
            <SearchableSelect
              label={t('nav.directions')}
              value={form.direction_id}
              onChange={v => setForm(f => ({ ...f, direction_id: v }))}
              placeholder={`— ${t('common.optional')} —`}
              searchPlaceholder={t('common.search')}
              emptyMessage={t('common.noData')}
              options={directions.map(d => ({ value: d.id, label: d.name }))}
            />
          )}
          <SearchableSelect
            label={t('groups.teacher')}
            value={form.teacher_id}
            onChange={v => setForm(f => ({ ...f, teacher_id: v }))}
            placeholder={`— ${t('common.optional')} —`}
            searchPlaceholder={t('common.search')}
            emptyMessage={t('common.noData')}
            options={teachers.map(tch => ({ value: tch.id, label: `${tch.first_name} ${tch.last_name}` }))}
          />
          <Input label={t('groups.maxStudents')} type="number" value={form.max_students}
            onChange={e => setForm(f => ({ ...f, max_students: parseInt(e.target.value) || 30 }))} />
          {/* Start date — left blank, the server auto-fills today's date */}
          <Input label={t('groups.startDate')} type="date" value={form.start_date}
            hint={t('groups.startDateHint')}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />

          {/* Lesson days — drives the attendance register (a month of cells opens automatically) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('schedule.lessonDays')}</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => {
                const active = sameDays(form.schedule_days, p.days);
                const label = p.key === 'everyDay'
                  ? t('schedule.everyDay')
                  : p.days.map(d => getDayName(d, t).slice(0, 3)).join(' · ');
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, schedule_days: p.days }))}
                    className={cn('px-2.5 py-1 text-xs rounded-full border transition-colors',
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_ORDER.map(d => {
                const active = form.schedule_days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    title={getDayName(d, t)}
                    className={cn('w-11 py-1.5 text-xs font-medium rounded border transition-colors',
                      active
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                  >
                    {getDayName(d, t).slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {form.schedule_days.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <Input label={t('schedule.startTime')} type="time" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                <Input label={t('schedule.endTime')} type="time" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            )}
          </div>

          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('common.active')}</span>
            </label>
          )}
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
        title={t('groups.deleteGroup')}
        message={t('groups.deleteConfirm')}
        loading={deleting}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </DashboardLayout>
  );
}
