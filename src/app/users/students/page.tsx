'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { GraduateModal } from '@/components/users/GraduateModal';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  address: string | null;
  mother_phone: string | null;
  birth_year: number | null;
  father_name: string | null;
  mother_name: string | null;
}

interface Branch { id: string; name: string; }

interface UserForm {
  username: string; email: string; password: string; first_name: string; last_name: string;
  phone: string; branch_id: string; is_active: boolean; created_at: string;
  address: string; mother_phone: string; birth_year: string;
  father_name: string; mother_name: string;
}

const emptyForm: UserForm = { username: '', email: '', password: '', first_name: '', last_name: '', phone: '', branch_id: '', is_active: true, created_at: '', address: '', mother_phone: '', birth_year: '', father_name: '', mother_name: '' };
const currentYear = new Date().getFullYear();
const ageFromBirthYear = (year: number | null) => (year ? currentYear - year : null);

export default function StudentsPage() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [graduateTarget, setGraduateTarget] = useState<User | null>(null);
  const [exporting, setExporting] = useState(false);

  const filterParams = {
    search: search || undefined,
    branch_id: branchFilter || undefined,
    is_active: activeFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: User[]; total: number; pages: number }>(
        '/api/users',
        { role: 'student', graduated: 'false', ...filterParams, page, limit }
      );
      setUsers(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchFilter, activeFilter, dateFrom, dateTo, page, limit, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      api.get<{ data: Branch[] }>('/api/branches').then(d => setBranches(d.data)).catch(() => {});
    }
  }, [currentUser]);

  const openEdit = useCallback((u: User) => {
    setEditingUser(u);
    setForm({
      username: u.username, email: u.email || '', password: '', first_name: u.first_name, last_name: u.last_name,
      phone: u.phone || '', branch_id: u.branch_id || '', is_active: u.is_active, created_at: u.created_at ? u.created_at.slice(0, 10) : '',
      address: u.address || '', mother_phone: u.mother_phone || '', birth_year: u.birth_year ? String(u.birth_year) : '',
      father_name: u.father_name || '', mother_name: u.mother_name || '',
    });
    setModalOpen(true);
  }, []);

  // Deep-link support: /users/students?edit=<id> (used by the profile page's edit link)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    api.get<User>(`/api/users/${editId}`).then(openEdit).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openCreate = () => { setEditingUser(null); setForm({ ...emptyForm, branch_id: currentUser?.branch_id || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.username || !form.first_name || !form.last_name) return toast(t('errors.required'), 'error');
    if (!editingUser && !form.password) return toast('Password is required', 'error');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, role: 'student', branch_id: form.branch_id || null };
      if (!payload.password) delete payload.password;
      if (!payload.created_at) delete payload.created_at;
      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, payload);
        toast(t('users.userUpdated'), 'success');
      } else {
        await api.post('/api/users', payload);
        toast(t('users.userCreated'), 'success');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/users/${deleteTarget.id}`);
      toast(t('users.userDeleted'), 'success');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    if (newPassword.length < 6) return toast(t('errors.minLength', { min: 6 }), 'error');
    setResetting(true);
    try {
      await api.post(`/api/users/${resetTarget.id}/reset-password`, { newPassword });
      toast(t('users.passwordReset'), 'success');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setResetting(false); }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await api.put(`/api/users/${u.id}`, { is_active: !u.is_active });
      toast(u.is_active ? 'User deactivated' : 'User activated', 'success');
      fetchUsers();
    } catch (err) { toast((err as Error).message, 'error'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(filterParams).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString();
      await downloadFile(`/api/users/students/export${qs ? `?${qs}` : ''}`, `students-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setExporting(false); }
  };

  const columns = [
    {
      key: 'user', header: t('common.name'),
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={u.first_name} lastName={u.last_name} avatarUrl={u.avatar_url} size="sm" />
          <div className="whitespace-nowrap">
            <div className="font-medium text-gray-900 dark:text-white">{u.first_name} {u.last_name}</div>
            <div className="text-xs text-gray-400">@{u.username}</div>
          </div>
        </div>
      )
    },
    { key: 'branch_name', header: t('common.branch'), render: (u: User) => <span>{u.branch_name || '—'}</span> },
    { key: 'age', header: t('users.age'), className: 'hidden md:table-cell', render: (u: User) => <span className="text-gray-500">{ageFromBirthYear(u.birth_year) ?? '—'}</span> },
    { key: 'email', header: t('common.email'), className: 'hidden xl:table-cell', render: (u: User) => <span className="text-gray-500 break-all">{u.email || '—'}</span> },
    { key: 'is_active', header: t('common.status'), render: (u: User) => (
      <Badge variant={u.is_active ? 'success' : 'default'}>
        {u.is_active ? t('common.active') : t('common.inactive')}
      </Badge>
    )},
    { key: 'created_at', header: t('common.createdAt'), className: 'hidden lg:table-cell', render: (u: User) => <span className="text-gray-500 text-xs whitespace-nowrap">{formatDate(u.created_at)}</span> },
    { key: 'last_login', header: t('common.lastLogin'), className: 'hidden xl:table-cell', render: (u: User) => <span className="text-gray-500 text-xs whitespace-nowrap">{u.last_login ? formatDate(u.last_login) : t('common.never')}</span> },
    { key: 'actions', header: t('common.actions'), render: (u: User) => (
      <div className="flex items-center gap-1">
        <Link href={`/users/${u.id}`}>
          <Button variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setResetTarget(u); setNewPassword(''); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}
          className={u.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setGraduateTarget(u)} title={t('users.graduate')}
          className="text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v6m-7-8.5V16c0 1.5 3 3 7 3s7-1.5 7-3v-4.5" />
          </svg>
        </Button>
        {currentUser?.role === 'super_admin' && (
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)} className="text-red-500 hover:bg-red-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('users.studentsTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} {t('common.total').toLowerCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('users.exportExcel')}
            </Button>
            <Button onClick={openCreate}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('users.addUser')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('common.search')}
              className="pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
          {currentUser?.role === 'super_admin' && branches.length > 0 && (
            <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('common.branch')}: {t('common.all')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('common.all')}</option>
            <option value="true">{t('common.active')}</option>
            <option value="false">{t('common.inactive')}</option>
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('users.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('users.dateTo')}</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
              {t('common.close')}
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={users} loading={loading} getKey={u => u.id} emptyMessage={t('common.noData')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? t('users.editUser') : t('users.addUser')} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('common.firstName')} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
          <Input label={t('common.lastName')} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
          <Input label={t('common.username')} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          <Input label={t('common.email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          {!editingUser && (
            <Input label={t('common.password')} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          )}
          <Input label={t('common.phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label={t('users.fatherName')} value={form.father_name} onChange={e => setForm(f => ({ ...f, father_name: e.target.value }))} />
          <Input label={t('users.motherName')} value={form.mother_name} onChange={e => setForm(f => ({ ...f, mother_name: e.target.value }))} />
          <Input label={t('users.motherPhone')} value={form.mother_phone} onChange={e => setForm(f => ({ ...f, mother_phone: e.target.value }))} />
          <Input
            label={t('users.birthYear')}
            type="number"
            min={1950}
            max={currentYear}
            value={form.birth_year}
            onChange={e => setForm(f => ({ ...f, birth_year: e.target.value }))}
            hint={form.birth_year ? `${t('users.age')}: ${ageFromBirthYear(Number(form.birth_year))}` : undefined}
          />
          <div className="col-span-2">
            <Input label={t('users.address')} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <Input label={t('common.createdAt')} type="date" value={form.created_at} onChange={e => setForm(f => ({ ...f, created_at: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">{t('users.joinDateHint')}</p>
          </div>
          {currentUser?.role === 'super_admin' && branches.length > 0 && (
            <Select
              label={t('common.branch')}
              value={form.branch_id}
              onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              placeholder={`— ${t('common.optional')} —`}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
            />
          )}
          {editingUser && (
            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('common.active')}</span>
            </label>
          )}
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} loading={saving}>{editingUser ? t('common.save') : t('common.create')}</Button>
        </div>
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('users.deleteUser')}
        message={t('users.deleteConfirm')}
        loading={deleting}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />

      {/* Reset Password */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={t('users.resetPassword')} size="sm">
        <p className="text-sm text-gray-500 mb-4">
          {t('users.resetPassword')} for <strong>{resetTarget?.first_name} {resetTarget?.last_name}</strong>
        </p>
        <Input
          label={t('users.newPassword')}
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="Min 6 characters"
        />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>{t('common.cancel')}</Button>
          <Button onClick={handleResetPassword} loading={resetting}>{t('common.save')}</Button>
        </div>
      </Modal>

      {/* Graduate */}
      <GraduateModal
        student={graduateTarget}
        onClose={() => setGraduateTarget(null)}
        onSaved={() => { setGraduateTarget(null); fetchUsers(); }}
      />
    </DashboardLayout>
  );
}
