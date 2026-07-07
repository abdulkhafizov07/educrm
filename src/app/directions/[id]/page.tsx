'use client';

import { useEffect, useState, use } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/contexts/I18nContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { colorOf } from '@/lib/colors';
import { cn, mediaUrl } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Building2,
  Users,
  GraduationCap,
  FolderKanban,
} from 'lucide-react';

interface GroupLite {
  id: string;
  name: string;
  max_students: number;
  is_active: boolean;
  teacher_name: string | null;
  student_count: string;
}

interface DirectionDetail {
  id: string;
  name: string;
  description: string | null;
  color: string;
  logo_url: string | null;
  branch_id: string | null;
  branch_name: string | null;
  teacher_count: string;
  student_count: string;
  group_count: string;
  groups: GroupLite[];
}

export default function DirectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { t } = useI18n();
  const router = useRouter();

  const [dir, setDir] = useState<DirectionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DirectionDetail>(`/api/directions/${id}`)
      .then(setDir)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-24">
          <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dir) return null;

  const c = colorOf(dir.color);

  const stats = [
    {
      v: dir.group_count,
      l: t('branches.groups'),
      icon: FolderKanban,
    },
    {
      v: dir.teacher_count,
      l: t('branches.teachers'),
      icon: GraduationCap,
    },
    {
      v: dir.student_count,
      l: t('branches.students'),
      icon: Users,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>

        {/* Header */}

        <div
          className={cn(
            'rounded-lg overflow-hidden border bg-white dark:bg-gray-900',
            c.border
          )}
        >
          <div className={cn('h-1', c.solid)} />

          <div className="p-5 flex items-center gap-4">

            <div
              className={cn(
                'w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center shrink-0',
                c.bg
              )}
            >
              {dir.logo_url ? (
                <img
                  src={mediaUrl(dir.logo_url) || ''}
                  alt={dir.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className={cn('w-7 h-7', c.text)} />
              )}
            </div>

            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {dir.name}
              </h1>

              {dir.branch_name && (
                <Link href={`/branches/${dir.branch_id}`} className="text-sm text-gray-500 hover:underline mt-1 inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {dir.branch_name}
                </Link>
              )}

              {dir.description && (
                <p className="text-sm text-gray-400 mt-1">
                  {dir.description}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Stats */}

        <div className="grid grid-cols-3 gap-4">

          {stats.map((s, i) => {
            const Icon = s.icon;

            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border p-4 bg-white dark:bg-gray-900 hover:shadow-md transition',
                  c.border
                )}
              >

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-xs text-gray-400">
                      {s.l}
                    </p>

                    <p
                      className={cn(
                        'text-2xl font-semibold mt-1',
                        c.text
                      )}
                    >
                      {s.v}
                    </p>

                  </div>

                  <div
                    className={cn(
                      'w-10 h-10 rounded-md flex items-center justify-center',
                      c.bg
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5',
                        c.text
                      )}
                    />
                  </div>

                </div>

              </div>
            );
          })}

        </div>

        {/* Groups */}

        <div>

          <h2 className="font-semibold text-lg mb-4 dark:text-white">
            {t('branches.groups')} ({dir.groups.length})
          </h2>

          {dir.groups.length === 0 ? (
            <div className="rounded-lg border p-8 bg-white dark:bg-gray-900 text-center text-sm text-gray-400">
              {t('common.noData')}
            </div>
          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {dir.groups.map((g) => (

                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className={cn(
                    'block rounded-lg border overflow-hidden bg-white dark:bg-gray-900 hover:shadow-md transition',
                    c.border
                  )}
                >

                  <div className={cn('h-1', c.solid)} />

                  <div className="p-4">

                    <div className="flex gap-3 items-center mb-3">

                      <div className={cn('w-10 h-10 rounded-md flex items-center justify-center shrink-0', c.bg)}>
                        <FolderKanban className={cn('w-5 h-5', c.text)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate dark:text-white">{g.name}</h3>
                        <p className="text-xs text-gray-400 truncate">{g.teacher_name || '—'}</p>
                      </div>

                      <Badge variant={g.is_active ? 'success' : 'default'}>
                        {g.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>

                    </div>

                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {g.student_count}/{g.max_students}
                      </span>
                    </div>

                  </div>

                </Link>

              ))}

            </div>

          )}

        </div>

      </div>
    </DashboardLayout>
  );
}