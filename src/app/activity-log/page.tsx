'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';

interface ActivityLog {
  id: string; action: string; entity_type: string | null; created_at: string;
  user_name: string; role: string; details: Record<string, unknown> | null;
}

const actionColor = (action: string): 'success' | 'danger' | 'info' | 'warning' | 'default' => {
  if (action.includes('CREATED')) return 'success';
  if (action.includes('DELETED')) return 'danger';
  if (action.includes('LOGIN')) return 'info';
  if (action.includes('UPDATED') || action.includes('RESET')) return 'warning';
  return 'default';
};

const actionLabel = (action: string) => {
  const map: Record<string, string> = {
    USER_LOGIN: 'Logged in', USER_LOGOUT: 'Logged out', USER_CREATED: 'Created user',
    USER_UPDATED: 'Updated user', USER_DELETED: 'Deleted user', BRANCH_CREATED: 'Created branch',
    BRANCH_UPDATED: 'Updated branch', BRANCH_DELETED: 'Deleted branch', GROUP_CREATED: 'Created group',
    GROUP_UPDATED: 'Updated group', GROUP_DELETED: 'Deleted group', ATTENDANCE_SAVED: 'Saved attendance',
    PASSWORD_RESET: 'Reset password', PASSWORD_CHANGED: 'Changed password',
    STUDENT_ADDED_TO_GROUP: 'Added student to group', STUDENT_REMOVED_FROM_GROUP: 'Removed student from group',
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase();
};

export default function ActivityLogPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetch = useCallback(async () => {
    try {
      const data = await api.get<{ data: ActivityLog[]; total: number }>(
        '/api/dashboard/activity-logs', { page, limit }
      );
      setLogs(data.data);
      setTotal(data.total);
    } catch (err) { toast((err as Error).message, 'error'); }
  }, [page, limit, toast]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'super_admin' && user.role !== 'branch_admin') {
      router.replace('/dashboard');
      return;
    }
    fetch();
  }, [fetch, user, router]);

  const pages = Math.ceil(total / limit);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.activityLog')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total events</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">{t('common.noData')}</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-500 shrink-0">
                    {log.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{log.user_name || 'Unknown'}</span>
                      <Badge variant={actionColor(log.action)} className="text-xs">{actionLabel(log.action)}</Badge>
                      {log.entity_type && <span className="text-xs text-gray-400">{log.entity_type}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>
    </DashboardLayout>
  );
}
