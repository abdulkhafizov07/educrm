'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { formatTime, getDayName, cn } from '@/lib/utils';
import { ACCENT_COLORS, colorOf, type AccentColor } from '@/lib/colors';

interface Schedule {
  id: string; group_id: string; group_name: string; branch_id: string | null; branch_name: string | null; teacher_name: string;
  day_of_week: number; start_time: string; end_time: string; classroom: string | null;
}
interface Group { id: string; name: string; }

const DAYS = [1, 2, 3, 4, 5, 6, 0];

export default function SchedulePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ group_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:30', classroom: '' });
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtrlar: matn qidiruvi (guruh/o'qituvchi/xona), filial va guruh bo'yicha
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const canEdit = user?.role === 'super_admin' || user?.role === 'branch_admin';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Schedule[]>('/api/schedules');
      setSchedules(data);
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (canEdit) {
      api.get<{ data: Group[] }>('/api/groups', { limit: 100 }).then(d => setGroups(d.data)).catch(() => {});
    }
  }, [canEdit]);

  const openCreate = () => {
    setEditing(null);
    setForm({ group_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:30', classroom: '' });
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({ group_id: s.group_id, day_of_week: s.day_of_week, start_time: s.start_time.substring(0, 5), end_time: s.end_time.substring(0, 5), classroom: s.classroom || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.group_id || !form.start_time || !form.end_time) return toast(t('errors.required'), 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/schedules/${editing.id}`, form);
      } else {
        await api.post('/api/schedules', form);
      }
      toast(t('common.success'), 'success');
      setModalOpen(false);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/schedules/${deleteTarget.id}`);
      toast(t('common.success'), 'success');
      setDeleteTarget(null);
      fetch();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setDeleting(false); }
  };

  // Give each group its own accent color so a student in several groups can tell
  // lessons apart at a glance (and a legend maps each color back to its group name).
  const groupColors = useMemo(() => {
    const map = new Map<string, AccentColor>();
    let i = 0;
    for (const s of schedules) {
      if (!map.has(s.group_id)) { map.set(s.group_id, ACCENT_COLORS[i % ACCENT_COLORS.length]); i++; }
    }
    return map;
  }, [schedules]);

  // Filial filtri variantlari — jadval ma'lumotining o'zidan (bitta filialli rollarda select chiqmaydi)
  const branchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of schedules) if (s.branch_id && s.branch_name && !seen.has(s.branch_id)) seen.set(s.branch_id, s.branch_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules]);

  // Qidiruv + filial filtri qo'llangan ro'yxat (guruh filtrisiz — legenda chiplariga asos)
  const preGroupFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter(s => {
      if (branchFilter && s.branch_id !== branchFilter) return false;
      if (q && !`${s.group_name} ${s.teacher_name || ''} ${s.classroom || ''} ${s.branch_name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schedules, branchFilter, search]);

  // Yakuniy ko'rinadigan ro'yxat (guruh filtri ham qo'llangan)
  const visible = useMemo(
    () => (groupFilter ? preGroupFiltered.filter(s => s.group_id === groupFilter) : preGroupFiltered),
    [preGroupFiltered, groupFilter]
  );

  // Legenda chiplari — bosilsa shu guruh bo'yicha filtr yoqiladi/o'chadi.
  // Bir xil nomli guruhlar (turli filiallarda) filial nomi bilan ajratiladi.
  const legend = useMemo(() => {
    const seen = new Map<string, { name: string; branch: string | null }>();
    for (const s of preGroupFiltered) if (!seen.has(s.group_id)) seen.set(s.group_id, { name: s.group_name, branch: s.branch_name });
    const nameCounts = new Map<string, number>();
    for (const { name } of seen.values()) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    return [...seen.entries()].map(([id, { name, branch }]) => ({
      id,
      name,
      label: (nameCounts.get(name) || 0) > 1 && branch ? `${name} · ${branch}` : name,
      cc: colorOf(groupColors.get(id)),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [preGroupFiltered, groupColors]);

  const hasFilters = !!(search || branchFilter || groupFilter);

  // Bugun/kecha statistikasi — tanlangan filial (tanlanmasa butun ro'yxat) bo'yicha
  // darslar soni va umumiy dars soati. Jadval haftalik bo'lgani uchun bugun/kecha
  // shu hafta kunlariga to'g'ri keladigan darslardan hisoblanadi.
  const todayDow = new Date().getDay();
  const yesterdayDow = (todayDow + 6) % 7;
  const dayTotals = useCallback((dow: number) => {
    const base = branchFilter ? schedules.filter(s => s.branch_id === branchFilter) : schedules;
    const items = base.filter(s => s.day_of_week === dow);
    const minutes = items.reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0);
    return { count: items.length, minutes };
  }, [schedules, branchFilter]);
  const todayStats = useMemo(() => dayTotals(todayDow), [dayTotals, todayDow]);
  const yesterdayStats = useMemo(() => dayTotals(yesterdayDow), [dayTotals, yesterdayDow]);

  const fmtDuration = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h && min) return t('schedule.durationHM', { h, m: min });
    if (h) return t('schedule.durationH', { h });
    return t('schedule.durationM', { m: min });
  };

  const selectedBranchName = branchFilter ? branchOptions.find(b => b.id === branchFilter)?.name : null;

  // Group by day
  const byDay = DAYS.map(day => ({
    day,
    items: visible.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter(d => d.items.length > 0 || canEdit);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('schedule.title')}</h1>
          {canEdit && (
            <Button onClick={openCreate}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('schedule.addSchedule')}
            </Button>
          )}
        </div>

        {/* Filtrlar: qidiruv + filial + guruh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
          {branchOptions.length > 1 && (
            <select value={branchFilter}
              onChange={e => { setBranchFilter(e.target.value); setGroupFilter(''); }}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('common.branch')}: {t('common.all')}</option>
              {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {legend.length > 1 && (
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[240px]">
              <option value="">{t('users.group')}: {t('common.all')}</option>
              {legend.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setBranchFilter(''); setGroupFilter(''); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('common.close')}
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{visible.length} / {schedules.length}</span>
        </div>

        {/* Bugun/kecha: tanlangan filialdagi darslar soni va umumiy dars soati */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-xl">
          {[
            { label: t('schedule.statsToday'), day: todayDow, stats: todayStats },
            { label: t('schedule.statsYesterday'), day: yesterdayDow, stats: yesterdayStats },
          ].map(({ label, day, stats }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label} · {getDayName(day, t)}</p>
                {selectedBranchName && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">{selectedBranchName}</span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('schedule.lessonsCount', { count: stats.count })}
                </span>
                {stats.minutes > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">· {fmtDuration(stats.minutes)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Guruh legendasi — chip bosilsa shu guruh bo'yicha filtrlanadi (yana bosilsa bekor) */}
        {legend.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
            {legend.map(g => {
              const active = groupFilter === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupFilter(active ? '' : g.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors cursor-pointer',
                    active
                      ? cn('border-transparent text-white', g.cc.solid)
                      : cn('border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800', g.cc.bg)
                  )}
                >
                  {!active && <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', g.cc.solid)} />}
                  <span className={cn('text-xs font-medium', active ? 'text-white' : 'text-gray-600 dark:text-gray-300')}>{g.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {byDay.filter(d => d.items.length > 0).map(({ day, items }) => (
              <div key={day} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{getDayName(day, t)}</h3>
                </div>
                <div className="p-3 space-y-2">
                  {items.map(s => {
                    const cc = colorOf(groupColors.get(s.group_id));
                    return (
                    <div key={s.id} className={cn('rounded p-3 border border-l-4', cc.bg, cc.border)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', cc.text)}>{s.group_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(s.start_time)} — {formatTime(s.end_time)}
                          </p>
                          {s.teacher_name && <p className="text-xs text-gray-400 truncate">{s.teacher_name}</p>}
                          {s.classroom && <p className="text-xs text-gray-400">{s.classroom}</p>}
                          {branchOptions.length > 1 && s.branch_name && !branchFilter && (
                            <p className="text-xs text-gray-400 truncate">{s.branch_name}</p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 ml-2">
                            <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-blue-600 p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setDeleteTarget(s)} className="text-gray-400 hover:text-red-500 p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('schedule.editSchedule') : t('schedule.addSchedule')}>
        <div className="space-y-4">
          {!editing && (
            <Select
              label={t('nav.groups')}
              value={form.group_id}
              onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}
              placeholder="Select group"
              options={groups.map(g => ({ value: g.id, label: g.name }))}
              required
            />
          )}
          <Select
            label={t('schedule.dayOfWeek')}
            value={String(form.day_of_week)}
            onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
            options={[1,2,3,4,5,6,0].map(d => ({ value: String(d), label: getDayName(d, t) }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('schedule.startTime')} type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            <Input label={t('schedule.endTime')} type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Input label={t('schedule.classroom')} value={form.classroom} onChange={e => setForm(f => ({ ...f, classroom: e.target.value }))} />
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
        title={t('schedule.deleteSchedule')}
        message="Are you sure you want to delete this schedule?"
        loading={deleting}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </DashboardLayout>
  );
}
