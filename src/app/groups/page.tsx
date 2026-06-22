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
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import Link from 'next/link';

interface Group {
  id: string; name: string; branch_id: string; branch_name: string;
  teacher_id: string | null; teacher_name: string | null;
  student_count: string; max_students: number; is_active: boolean; created_at: string;
}
interface Branch { id: string; name: string; }
interface Teacher { id: string; first_name: string; last_name: string; }

interface GroupForm {
  name: string; branch_id: string; teacher_id: string; description: string; max_students: number; is_active: boolean;
}

const empty: GroupForm = { name: '', branch_id: '', teacher_id: '', description: '', max_students: 30, is_active: true };

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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, branch_id: user?.branch_id || '' });
    setModalOpen(true);
  };
  const openEdit = (g: Group) => {
    setEditing(g);
    setForm({ name: g.name, branch_id: g.branch_id, teacher_id: g.teacher_id || '', description: '', max_students: g.max_students, is_active: g.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.branch_id) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      const payload = { ...form, teacher_id: form.teacher_id || null, branch_id: form.branch_id };
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
      <Link href={`/groups/${g.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{g.name}</Link>
    )},
    { key: 'branch_name', header: t('common.branch'), render: (g: Group) => <span>{g.branch_name}</span> },
    { key: 'teacher_name', header: t('groups.teacher'), render: (g: Group) => <span>{g.teacher_name || '—'}</span> },
    { key: 'capacity', header: t('groups.capacity'), render: (g: Group) => (
      <span className="text-sm">{g.student_count}/{g.max_students}</span>
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
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={groups} loading={loading} getKey={g => g.id} emptyMessage={t('common.noData')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('groups.editGroup') : t('groups.addGroup')}>
        <div className="space-y-4">
          <Input label={t('groups.groupName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          {user?.role === 'super_admin' && (
            <Select
              label={t('common.branch')}
              value={form.branch_id}
              onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              placeholder="Select branch"
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              required
            />
          )}
          <Select
            label={t('groups.teacher')}
            value={form.teacher_id}
            onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
            placeholder={`— ${t('common.optional')} —`}
            options={teachers.map(t => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
          />
          <Input label={t('groups.maxStudents')} type="number" value={form.max_students}
            onChange={e => setForm(f => ({ ...f, max_students: parseInt(e.target.value) || 30 }))} />
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
