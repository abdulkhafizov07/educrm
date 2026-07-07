'use client';
import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatDateTime, mediaUrl } from '@/lib/utils';

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPw, setChangingPw] = useState(false);

  // App branding (super admin only)
  const [appName, setAppName] = useState('');
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [appLogoFile, setAppLogoFile] = useState<File | null>(null);
  const [appLogoPreview, setAppLogoPreview] = useState<string | null>(null);
  const [savingApp, setSavingApp] = useState(false);
  const appLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    api.get<{ app_name: string | null; logo_url: string | null }>('/api/settings')
      .then(s => { setAppName(s.app_name || ''); setAppLogoUrl(s.logo_url); })
      .catch(() => {});
  }, [user?.role]);

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put(`/api/users/${user.id}`, form);
      await refreshUser();
      toast(t('users.userUpdated'), 'success');
      setEditing(false);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.upload('/api/upload/avatar', fd);
      await refreshUser();
      toast('Avatar updated', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword)
      return toast(t('errors.required'), 'error');
    if (pwForm.newPassword !== pwForm.confirmPassword)
      return toast(t('errors.passwordMismatch'), 'error');
    if (pwForm.newPassword.length < 6)
      return toast(t('errors.minLength', { min: 6 }), 'error');
    setChangingPw(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast(t('auth.passwordChanged'), 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setChangingPw(false);
    }
  };

  const onAppLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast(t('errors.fileTooLarge'), 'error'); return; }
    if (appLogoPreview) URL.revokeObjectURL(appLogoPreview);
    setAppLogoFile(file);
    setAppLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveApp = async () => {
    setSavingApp(true);
    try {
      const fd = new FormData();
      fd.append('app_name', appName);
      if (appLogoFile) fd.append('logo', appLogoFile);
      await api.putFormData('/api/settings', fd);
      await refreshUser();
      toast(t('common.success'), 'success');
      setAppLogoFile(null);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSavingApp(false);
    }
  };

  const roleVariant = (
    role: string
  ): 'info' | 'danger' | 'success' | 'warning' | 'purple' => {
    const map: Record<string, 'info' | 'danger' | 'success' | 'warning' | 'purple'> =
      {
        super_admin: 'danger',
        branch_admin: 'purple',
        teacher: 'info',
        student: 'success',
      };
    return map[role] || 'info';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {t('profile.title')}
        </h1>

        {/* Avatar & basic info */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start gap-6">
            <div className="relative shrink-0">
              <Avatar
                firstName={user.first_name}
                lastName={user.last_name}
                avatarUrl={user.avatar_url}
                size="xl"
                className="ring-2 ring-white dark:ring-gray-800 shadow"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                title={t('profile.changeAvatar')}
              >
                {uploadingAvatar ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                @{user.username}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant={roleVariant(user.role)}>
                  {t(`users.roles.${user.role}`)}
                </Badge>
                {user.branch_name && (
                  <Badge variant="default">{user.branch_name}</Badge>
                )}
              </div>
              <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                <div>
                  {t('profile.memberSince')}: {formatDate(user.created_at)}
                </div>
                <div>
                  {t('common.lastLogin')}:{' '}
                  {user.last_login
                    ? formatDateTime(user.last_login)
                    : t('common.never')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('profile.personalInfo')}
            </h2>
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email || '',
                    phone: user.phone || '',
                  });
                  setEditing(true);
                }}
              >
                {t('profile.editProfile')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  loading={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {t('common.save')}
                </Button>
              </div>
            )}
          </div>
          <div className="p-6">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('common.firstName')}
                  value={form.first_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                />
                <Input
                  label={t('common.lastName')}
                  value={form.last_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                />
                <Input
                  label={t('common.email')}
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                <Input
                  label={t('common.phone')}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: t('common.firstName'), value: user.first_name },
                  { label: t('common.lastName'), value: user.last_name },
                  { label: t('common.email'), value: user.email || '—' },
                  { label: t('common.phone'), value: user.phone || '—' },
                  { label: t('common.username'), value: `@${user.username}` },
                  { label: t('common.branch'), value: user.branch_name || '—' },
                ].map((f, i) => (
                  <div key={i} className="border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {f.label}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* App branding — super admin uploads the logo shown instead of EduCRM */}
        {user.role === 'super_admin' && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('profile.appBranding')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => appLogoRef.current?.click()}
                  className="w-20 h-20 rounded overflow-hidden flex items-center justify-center shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 bg-gray-50 dark:bg-gray-800 transition-colors"
                >
                  {appLogoPreview || appLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appLogoPreview || mediaUrl(appLogoUrl) || ''} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <p className="text-xs text-gray-400">{t('branches.logoHint')}</p>
                <input ref={appLogoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onAppLogoChange} className="hidden" />
              </div>
              <Input label={t('profile.appName')} value={appName} onChange={e => setAppName(e.target.value)} placeholder="EduCRM" />
              <Button onClick={handleSaveApp} loading={savingApp} className="bg-blue-600 hover:bg-blue-700">{t('common.save')}</Button>
            </div>
          </div>
        )}

        {/* Change password */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('profile.security')}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <Input
              label={t('auth.currentPassword')}
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
            />
            <Input
              label={t('auth.newPassword')}
              type="password"
              value={pwForm.newPassword}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, newPassword: e.target.value }))
              }
              hint="Minimum 6 characters"
            />
            <Input
              label={t('auth.confirmPassword')}
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
            />
            <Button
              onClick={handleChangePassword}
              loading={changingPw}
              disabled={
                !pwForm.currentPassword ||
                !pwForm.newPassword ||
                !pwForm.confirmPassword
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {t('auth.changePassword')}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}