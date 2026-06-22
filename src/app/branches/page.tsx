'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  teacher_count: string;
  student_count: string;
  group_count: string;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
}

const empty: BranchForm = { name: '', address: '', phone: '', email: '', is_active: true };

export default function BranchesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 12;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Branch[]; total: number; pages: number }>(
        '/api/branches',
        { search: search || undefined, page, limit }
      );
      setBranches(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, limit, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, address: b.address || '', phone: b.phone || '', email: b.email || '', is_active: b.is_active }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/branches/${editing.id}`, form);
        toast(t('branches.updated'), 'success');
      } else {
        await api.post('/api/branches', form);
        toast(t('branches.created'), 'success');
      }
      setModalOpen(false);
      fetch();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/branches/${deleteTarget.id}`);
      toast(t('branches.deleted'), 'success');
      setDeleteTarget(null);
      fetch();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'super_admin') router.replace('/dashboard');
  }, [user, router]);

  if (user && user.role !== 'super_admin') return null;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('branches.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} {t('common.total').toLowerCase()}</p>
          </div>
          <Button onClick={openCreate}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('branches.add')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(branch => (
              <div key={branch.id} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <Link href={`/branches/${branch.id}`} className="group/title">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-400 transition-colors">{branch.name}</h3>
                    {branch.address && <p className="text-xs text-gray-400 mt-0.5">{branch.address}</p>}
                  </Link>
                  <Badge variant={branch.is_active ? 'success' : 'default'}>
                    {branch.is_active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>

                <Link href={`/branches/${branch.id}`} className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <span>{branch.student_count} {t('branches.students').toLowerCase()}</span>
                  <span>{branch.teacher_count} {t('branches.teachers').toLowerCase()}</span>
                  <span>{branch.group_count} {t('branches.groups').toLowerCase()}</span>
                </Link>

                {(branch.phone || branch.email) && (
                  <div className="space-y-0.5 mb-4">
                    {branch.phone && <p className="text-xs text-gray-400">{branch.phone}</p>}
                    {branch.email && <p className="text-xs text-gray-400">{branch.email}</p>}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-400">{formatDate(branch.created_at)}</span>
                  <div className="flex gap-2">
                    <Link href={`/branches/${branch.id}`}>
                      <Button variant="ghost" size="sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(branch)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(branch)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('branches.edit') : t('branches.add')}
      >
        <div className="space-y-4">
          <Input label={t('branches.branchName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label={t('common.address')} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Input label={t('common.phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label={t('common.email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('common.active')}</span>
            </label>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('branches.delete')}
        message={t('branches.deleteConfirm')}
        loading={deleting}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </DashboardLayout>
  );
}
