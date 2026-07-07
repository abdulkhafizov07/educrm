'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import { formatDate, mediaUrl, cn } from '@/lib/utils';
import { ACCENT_COLORS, colorOf, colorLabel, type AccentColor } from '@/lib/colors';
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
  direction_count: string;
  teacher_count: string;
  student_count: string;
  group_count: string;
  logo_url?: string | null;
  direction_id?: string | null;
  direction_name?: string | null;
  direction_color?: string | null;
  colors?: string[] | null;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
  colors: AccentColor[];
  created_at: string;
}

const empty: BranchForm = { name: '', address: '', phone: '', email: '', is_active: true, colors: [], created_at: '' };

export default function BranchesPage() {
  const { t, locale } = useI18n();
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

  const resetModal = () => {
    setEditing(null);
    setForm(empty);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const openCreate = () => {
    resetModal();
    setModalOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      is_active: b.is_active,
      colors: (b.colors || []).filter((c): c is AccentColor => ACCENT_COLORS.includes(c as AccentColor)),
      created_at: b.created_at ? b.created_at.slice(0, 10) : '',
    });
    setLogoFile(null);
    setLogoPreview(null);
    setModalOpen(true);
  };

  const toggleColor = (col: AccentColor) => {
    setForm(f => ({ ...f, colors: f.colors.includes(col) ? f.colors.filter(c => c !== col) : [...f.colors, col] }));
  };

  const closeModal = () => {
    setModalOpen(false);
    resetModal();
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('address', form.address || '');
      formData.append('phone', form.phone || '');
      formData.append('email', form.email || '');
      formData.append('colors', JSON.stringify(form.colors));
      if (form.created_at) formData.append('created_at', form.created_at); // empty -> backend auto-fills NOW()

      if (editing) {
        formData.append('is_active', String(form.is_active));
        if (logoFile) formData.append('logo', logoFile);
        await api.putFormData(`/api/branches/${editing.id}`, formData);
        toast(t('branches.updated'), 'success');
      } else {
        if (logoFile) formData.append('logo', logoFile);
        await api.postFormData('/api/branches', formData);
        toast(t('branches.created'), 'success');
      }
      closeModal();
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
        {/* Header */}
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
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(branch => {
              const colors = (branch.colors && branch.colors.length ? branch.colors : []) as string[];
              const pc = colors.length ? colorOf(colors[0]) : null;
              return (
              <div
                key={branch.id}
                className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Multi-color strip */}
                {colors.length > 0 && (
                  <div className="flex h-1 w-full">
                    {colors.map((col, i) => <div key={i} className={cn('flex-1', colorOf(col).solid)} />)}
                  </div>
                )}

                <div className="p-5">
                  {/* Header: kichik logo + nom + holat */}
                  <div className="flex items-start gap-3 mb-4">
                    <Link
                      href={`/branches/${branch.id}`}
                      className={cn(
                        'w-14 h-14 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border',
                        pc ? cn(pc.bg, pc.border) : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      )}
                    >
                      {branch.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(branch.logo_url) || ''}
                          alt={branch.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <svg className={cn('w-7 h-7', pc ? pc.text : 'text-gray-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/branches/${branch.id}`} className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate hover:underline">
                            {branch.name}
                          </h3>
                        </Link>
                        <Badge variant={branch.is_active ? 'success' : 'default'}>
                          {branch.is_active ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </div>
                      {branch.address && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{branch.address}</p>
                      )}
                      {(branch.phone || branch.email) && (
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          {branch.phone && <span className="text-xs text-gray-400">{branch.phone}</span>}
                          {branch.email && <span className="text-xs text-gray-400 truncate">{branch.email}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Statistika: bitta qator, ajratkichlar bilan */}
                  <Link
                    href={`/branches/${branch.id}`}
                    className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50 py-2.5 mb-4 text-center"
                  >
                    {[
                      { v: branch.direction_count, l: t('nav.directions') },
                      { v: branch.group_count, l: t('branches.groups') },
                      { v: branch.student_count, l: t('branches.students') },
                      { v: branch.teacher_count, l: t('branches.teachers') },
                    ].map((s, i) => (
                      <div key={i} className="px-1">
                        <div className={cn('text-base font-bold leading-tight', pc ? pc.text : 'text-gray-900 dark:text-white')}>{s.v}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{s.l}</div>
                      </div>
                    ))}
                  </Link>

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
              </div>
              );
            })}
          </div>
        )}

        <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
      </div>

      {/* ===== Modal ===== */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t('branches.edit') : t('branches.add')}
      >
        <div className="space-y-4">
          <Input
            label={t('branches.branchName')}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label={t('common.address')}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          <Input
            label={t('common.phone')}
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label={t('common.email')}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          {/* Created date — left blank, the server auto-fills the current date */}
          <Input
            label={t('common.createdAt')}
            type="date"
            value={form.created_at}
            hint={t('users.joinDateHint')}
            onChange={e => setForm(f => ({ ...f, created_at: e.target.value }))}
          />

          {/* Card colors (multiple) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('branches.colors')}</label>
            <div className="flex gap-2">
              {ACCENT_COLORS.map(col => {
                const active = form.colors.includes(col);
                return (
                  <button key={col} type="button" onClick={() => toggleColor(col)}
                    title={colorLabel[col][locale as 'en' | 'ru' | 'uz']}
                    className={cn('w-8 h-8 rounded-full transition-transform', colorOf(col).solid,
                      active ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-110 ' + colorOf(col).ring : 'opacity-60 hover:opacity-100')}>
                    {active && (
                      <svg className="w-4 h-4 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== LOGO UPLOAD ===== */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('branches.logo')}
            </label>
            <div className="flex items-center gap-4">
              {(() => {
                const current = logoPreview || (editing && !logoFile ? mediaUrl(editing.logo_url) : null);
                return (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="group relative w-20 h-20 rounded overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 bg-gray-50 dark:bg-gray-800 transition-colors"
                  >
                    {current ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={current} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </span>
                      </>
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-gray-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] font-medium">{t('branches.uploadLogo')}</span>
                      </span>
                    )}
                  </button>
                );
              })()}

              <div className="text-xs text-gray-400 space-y-1">
                <p>{t('branches.logoHint')}</p>
                {(logoPreview || logoFile) && (
                  <button type="button" onClick={clearLogo} className="text-red-500 hover:text-red-600 font-medium">
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onLogoChange}
              className="hidden"
            />
          </div>

          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded-lg border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('common.active')}</span>
            </label>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Dialog */}
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