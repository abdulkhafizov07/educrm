'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import { ACCENT_COLORS, colorOf, colorLabel, type AccentColor } from '@/lib/colors';
import { cn, mediaUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Direction {
  id: string;
  name: string;
  description: string | null;
  color: string;
  logo_url: string | null;
  is_active: boolean;
  branch_id: string | null;
  branch_name: string | null;
  teacher_count: string;
  student_count: string;
  group_count: string;
}

interface BranchLite { id: string; name: string; }

interface DirectionForm { name: string; description: string; color: AccentColor; branch_id: string; }
const empty: DirectionForm = { name: '', description: '', color: 'blue', branch_id: '' };

export default function DirectionsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [items, setItems] = useState<Direction[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = user?.role === 'super_admin' || user?.role === 'branch_admin';
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Direction | null>(null);
  const [form, setForm] = useState<DirectionForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Direction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast(t('errors.fileTooLarge'), 'error'); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };
  const clearLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Direction[] }>('/api/directions');
      setItems(data.data);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') router.replace('/dashboard');
  }, [user, router]);

  // Super admin picks the branch a direction belongs to
  useEffect(() => {
    if (user?.role === 'super_admin') {
      api.get<{ data: BranchLite[] }>('/api/branches', { limit: 200 }).then(d => setBranches(d.data)).catch(() => {});
    }
  }, [user]);

  const openCreate = () => { setEditing(null); setForm(empty); clearLogo(); setModalOpen(true); };
  const openEdit = (d: Direction) => {
    setEditing(d);
    setForm({ name: d.name, description: d.description || '', color: (d.color as AccentColor) || 'blue', branch_id: d.branch_id || '' });
    clearLogo();
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('errors.required'), 'error');
    if (user?.role === 'super_admin' && !form.branch_id) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description || '');
      fd.append('color', form.color);
      if (user?.role === 'super_admin') fd.append('branch_id', form.branch_id);
      if (logoFile) fd.append('logo', logoFile);

      if (editing) {
        await api.putFormData(`/api/directions/${editing.id}`, fd);
        toast(t('directions.updated'), 'success');
      } else {
        await api.postFormData('/api/directions', fd);
        toast(t('directions.created'), 'success');
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
      await api.delete(`/api/directions/${deleteTarget.id}`);
      toast(t('directions.deleted'), 'success');
      setDeleteTarget(null);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  };

  if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') return null;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('directions.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{items.length} {t('common.total').toLowerCase()}</p>
          </div>
          <Button onClick={openCreate}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('directions.add')}
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(d => {
              const c = colorOf(d.color);
              return (
                <div key={d.id} className={cn('relative bg-white dark:bg-gray-900 rounded-lg border overflow-hidden hover:shadow-sm transition-shadow', c.border)}>
                  <div className={cn('h-1.5 w-full', c.solid)} />
                  {/* Image at the top of the card */}
                  <Link href={`/directions/${d.id}`} className={cn('block w-full h-32 relative', c.bg)}>
                    {d.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(d.logo_url) || ''} alt={d.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn('w-full h-full flex items-center justify-center', c.text)}>
                        <svg className="w-10 h-10 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      </div>
                    )}
                  </Link>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/directions/${d.id}`} className="flex items-center gap-3 group/title min-w-0">
                        <div className={cn('w-10 h-10 rounded flex items-center justify-center shrink-0', c.bg, c.text)}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover/title:underline">{d.name}</h3>
                          {d.branch_name && <p className="text-xs text-gray-400 truncate">{d.branch_name}</p>}
                          {d.description && <p className="text-xs text-gray-400 truncate">{d.description}</p>}
                        </div>
                      </Link>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </Button>
                      </div>
                    </div>
                    <Link href={`/directions/${d.id}`} className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { v: d.group_count, l: t('branches.groups') },
                        { v: d.teacher_count, l: t('branches.teachers') },
                        { v: d.student_count, l: t('branches.students') },
                      ].map((s, i) => (
                        <div key={i} className={cn('rounded py-2', c.bg)}>
                          <div className={cn('text-lg font-semibold', c.text)}>{s.v}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{s.l}</div>
                        </div>
                      ))}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('directions.edit') : t('directions.add')}>
        <div className="space-y-4">
          <Input label={t('directions.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label={t('directions.description')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          {user?.role === 'super_admin' && (
            <Select
              label={t('common.branch')}
              value={form.branch_id}
              onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              placeholder={t('common.branch')}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              required
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('directions.color')}</label>
            <div className="flex gap-2">
              {ACCENT_COLORS.map(col => (
                <button key={col} type="button" onClick={() => setForm(f => ({ ...f, color: col }))}
                  title={colorLabel[col][locale as 'en' | 'ru' | 'uz']}
                  className={cn('w-8 h-8 rounded-full transition-transform', colorOf(col).solid,
                    form.color === col ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-110 ' + colorOf(col).ring : 'opacity-70 hover:opacity-100')} />
              ))}
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('branches.logo')}</label>
            <div className="flex items-center gap-4">
              {(() => {
                const current = logoPreview || (editing && !logoFile ? mediaUrl(editing.logo_url) : null);
                return (
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    className="group relative w-20 h-20 rounded overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 bg-gray-50 dark:bg-gray-800 transition-colors">
                    {current ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={current} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </span>
                      </>
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-medium">{t('branches.uploadLogo')}</span>
                      </span>
                    )}
                  </button>
                );
              })()}
              <div className="text-xs text-gray-400 space-y-1">
                <p>{t('branches.logoHint')}</p>
                {(logoPreview || logoFile) && (
                  <button type="button" onClick={clearLogo} className="text-red-500 hover:text-red-600 font-medium">{t('common.remove')}</button>
                )}
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoChange} className="hidden" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title={t('directions.delete')} message={t('directions.deleteConfirm')} loading={deleting}
        confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} />
    </DashboardLayout>
  );
}
