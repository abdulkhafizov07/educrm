'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Notification {
  id: string; title: string; message: string; type: string; is_read: boolean; created_at: string;
}
interface RecipientUser { id: string; first_name: string; last_name: string; username: string; }
interface BranchLite { id: string; name: string; }
type SendTarget = 'user' | 'students' | 'teachers' | 'branch';

const typeVariant = (type: string) => {
  const m: Record<string, 'info' | 'success' | 'warning' | 'danger'> = { info: 'info', success: 'success', warning: 'warning', error: 'danger' };
  return m[type] || 'info';
};

export default function NotificationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 30;
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [sendForm, setSendForm] = useState({ target: 'user' as SendTarget, user_ids: [] as string[], branch_id: '', title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);

  const canSend = user?.role === 'super_admin' || user?.role === 'branch_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Notification[]; total: number; unreadCount: number }>(
        '/api/notifications', { page, limit }
      );
      setNotifications(data.data);
      setTotal(data.total);
      setUnreadCount(data.unreadCount);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [page, limit, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const markRead = async (id: string) => {
    await api.put(`/api/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.put('/api/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    toast(t('common.success'), 'success');
  };

  const deleteNotif = async (id: string) => {
    await api.delete(`/api/notifications/${id}`);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const openSend = async () => {
    if (!canSend) return;
    setSendForm({ target: 'user', user_ids: [], branch_id: '', title: '', message: '', type: 'info' });
    setSendOpen(true);
    try {
      const data = await api.get<{ data: RecipientUser[] }>('/api/users', { limit: 500 });
      setUsers(data.data.filter(u => u.id !== user?.id));
      if (isSuperAdmin) {
        const b = await api.get<{ data: BranchLite[] }>('/api/branches');
        setBranches(b.data);
      }
    } catch (err) { toast((err as Error).message, 'error'); }
  };

  const handleSend = async () => {
    if (!sendForm.title || !sendForm.message) return toast(t('errors.required'), 'error');
    if (sendForm.target === 'user' && sendForm.user_ids.length === 0) return toast(t('errors.required'), 'error');
    if (sendForm.target === 'branch' && isSuperAdmin && !sendForm.branch_id) return toast(t('errors.required'), 'error');
    setSending(true);
    try {
      const res = await api.post<{ count?: number }>('/api/notifications', sendForm);
      toast(res?.count && res.count > 1 ? `${t('common.success')} (${res.count})` : t('common.success'), 'success');
      setSendOpen(false);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSending(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('notifications.title')}</h1>
            {unreadCount > 0 && <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>{t('notifications.markAllRead')}</Button>
            )}
            {canSend && (
              <Button size="sm" onClick={openSend}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {t('notifications.sendNotification')}
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-gray-400 text-sm">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn('px-5 py-4 flex gap-3 transition-colors', !n.is_read && 'bg-blue-50/50 dark:bg-blue-900/10')}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', n.is_read ? 'bg-gray-200 dark:bg-gray-700' : 'bg-blue-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-medium', n.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white')}>
                        {n.title}
                      </p>
                      <Badge variant={typeVariant(n.type)}>{n.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                    className="text-gray-300 hover:text-red-400 shrink-0 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t('notifications.sendNotification')}>
        <div className="space-y-4">
          <Select
            label={t('notifications.audience')}
            value={sendForm.target}
            onChange={e => setSendForm(f => ({ ...f, target: e.target.value as SendTarget, user_ids: [], branch_id: '' }))}
            options={[
              { value: 'user', label: t('notifications.individual') },
              { value: 'students', label: t('notifications.allStudents') },
              { value: 'teachers', label: t('notifications.allTeachers') },
              { value: 'branch', label: t('notifications.byBranch') },
            ]}
          />
          {sendForm.target === 'user' && (
            <SearchableMultiSelect
              label={t('notifications.recipient')}
              values={sendForm.user_ids}
              onChange={ids => setSendForm(f => ({ ...f, user_ids: ids }))}
              placeholder={t('notifications.selectRecipients')}
              searchPlaceholder={t('notifications.searchUsers')}
              emptyMessage={t('notifications.noResults')}
              options={users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name} (@${u.username})` }))}
              required
            />
          )}
          {sendForm.target === 'branch' && isSuperAdmin && (
            <Select
              label={t('common.branch')}
              value={sendForm.branch_id}
              onChange={e => setSendForm(f => ({ ...f, branch_id: e.target.value }))}
              placeholder={t('notifications.selectBranch')}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
              required
            />
          )}
          <Input
            label={t('notifications.notificationTitle')}
            value={sendForm.title}
            onChange={e => setSendForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('notifications.message')} *</label>
            <textarea
              value={sendForm.message}
              onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
              rows={3}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <Select
            label={t('notifications.type')}
            value={sendForm.type}
            onChange={e => setSendForm(f => ({ ...f, type: e.target.value }))}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'success', label: 'Success' },
              { value: 'warning', label: 'Warning' },
              { value: 'error', label: 'Error' },
            ]}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>{t('common.cancel')}</Button>
            <Button onClick={handleSend} loading={sending}>{sending ? t('common.sending') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
