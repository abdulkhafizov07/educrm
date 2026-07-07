'use client';
import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { GraduateModal } from '@/components/users/GraduateModal';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Graduate {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  graduated_at: string | null;
  graduation_note: string | null;
  graduated_branch_id: string | null;
  graduated_branch_name: string | null;
  graduated_group_id: string | null;
  graduated_group_name: string | null;
}

interface Branch { id: string; name: string; }
interface GroupOption { id: string; name: string; }

export default function GraduatesPage() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [editTarget, setEditTarget] = useState<Graduate | null>(null);
  const [revertTarget, setRevertTarget] = useState<Graduate | null>(null);
  const [reverting, setReverting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterParams = {
    search: search || undefined,
    branch_id: branchFilter || undefined,
    group_id: groupFilter || undefined,
    graduated_from: dateFrom || undefined,
    graduated_to: dateTo || undefined,
  };

  const fetchGraduates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Graduate[]; total: number; pages: number }>(
        '/api/users',
        { role: 'student', graduated: 'true', ...filterParams, page, limit }
      );
      setGraduates(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchFilter, groupFilter, dateFrom, dateTo, page, limit, toast]);

  useEffect(() => { fetchGraduates(); }, [fetchGraduates]);
  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      api.get<{ data: Branch[] }>('/api/branches').then(d => setBranches(d.data)).catch(() => {});
    }
    api.get<{ data: GroupOption[] }>('/api/groups', { limit: 200 }).then(d => setGroups(d.data)).catch(() => {});
  }, [currentUser]);

  const handleRevert = async () => {
    if (!revertTarget) return;
    setReverting(true);
    try {
      await api.delete(`/api/users/${revertTarget.id}/graduate`);
      toast(t('users.graduationReverted'), 'success');
      setRevertTarget(null);
      fetchGraduates();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setReverting(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(filterParams).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString();
      await downloadFile(`/api/users/graduates/export${qs ? `?${qs}` : ''}`, `graduates-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setExporting(false); }
  };

  const columns = [
    {
      key: 'user', header: t('common.name'),
      render: (g: Graduate) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={g.first_name} lastName={g.last_name} avatarUrl={g.avatar_url} size="sm" />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{g.first_name} {g.last_name}</div>
            <div className="text-xs text-gray-400">@{g.username}</div>
          </div>
        </div>
      )
    },
    { key: 'branch', header: t('common.branch'), render: (g: Graduate) => <span>{g.graduated_branch_name || '—'}</span> },
    { key: 'group', header: t('groups.title'), render: (g: Graduate) => <span>{g.graduated_group_name || '—'}</span> },
    { key: 'graduated_at', header: t('users.graduatedAt'), render: (g: Graduate) => <span className="text-gray-500 text-xs">{g.graduated_at ? formatDate(g.graduated_at) : '—'}</span> },
    { key: 'note', header: t('users.graduateNote'), render: (g: Graduate) => (
      <span className="text-gray-500 text-sm block max-w-xs truncate" title={g.graduation_note || ''}>
        {g.graduation_note || '—'}
      </span>
    )},
    { key: 'actions', header: t('common.actions'), render: (g: Graduate) => (
      <div className="flex items-center gap-1">
        <Link href={`/users/${g.id}`}>
          <Button variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setEditTarget(g)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRevertTarget(g)} title={t('users.revertGraduation')}
          className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </Button>
      </div>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('users.graduatesTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} {t('common.total').toLowerCase()}</p>
          </div>
          <Button variant="outline" onClick={handleExport} loading={exporting}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('users.exportExcel')}
          </Button>
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
          {groups.length > 0 && (
            <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('groups.title')}: {t('common.all')}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
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
          {(dateFrom || dateTo || branchFilter || groupFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setBranchFilter(''); setGroupFilter(''); setPage(1); }}>
              {t('common.close')}
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <Table columns={columns} data={graduates} loading={loading} getKey={g => g.id} emptyMessage={t('common.noData')} />
          <Pagination page={page} pages={pages} total={total} limit={limit} onChange={setPage} t={t} />
        </div>
      </div>

      {/* Edit note/group */}
      <GraduateModal
        student={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); fetchGraduates(); }}
      />

      {/* Revert graduation */}
      <ConfirmDialog
        open={!!revertTarget}
        onClose={() => setRevertTarget(null)}
        onConfirm={handleRevert}
        title={t('users.revertGraduation')}
        message={t('users.revertGraduationConfirm')}
        loading={reverting}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
      />
    </DashboardLayout>
  );
}
