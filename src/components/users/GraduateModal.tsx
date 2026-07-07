'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface GraduateTarget {
  id: string;
  first_name: string;
  last_name: string;
  graduated_group_id?: string | null;
  graduation_note?: string | null;
}

interface GroupOption { id: string; name: string; branch_name: string; }

interface GraduateModalProps {
  student: GraduateTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

// Marks a student as graduated (or edits an existing graduation record) — group + note.
// Reused by both the Students page (graduate action) and the Graduates page (edit action).
export function GraduateModal({ student, onClose, onSaved }: GraduateModalProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState('');
  const [note, setNote] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!student) return;
    setGroupId(student.graduated_group_id || '');
    setNote(student.graduation_note || '');
    setLoadingGroups(true);
    api.get<{ data: GroupOption[] }>('/api/groups', { student_id: student.id, limit: 100 })
      .then(d => setGroups(d.data))
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, [student]);

  const handleSave = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await api.post(`/api/users/${student.id}/graduate`, { group_id: groupId || null, note: note || null });
      toast(t('users.graduateSaved'), 'success');
      onSaved();
    } catch (err) { toast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!student} onClose={onClose} title={t('users.graduate')} size="md">
      {student && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {student.first_name} {student.last_name}
          </p>
          <SearchableSelect
            label={t('users.graduateGroup')}
            value={groupId}
            onChange={setGroupId}
            placeholder={loadingGroups ? t('common.loading') : `— ${t('common.optional')} —`}
            searchPlaceholder={t('common.search')}
            emptyMessage={t('attendance.noGroups')}
            disabled={loadingGroups}
            options={groups.map(g => ({ value: g.id, label: `${g.name} — ${g.branch_name}` }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.graduateNote')}</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
