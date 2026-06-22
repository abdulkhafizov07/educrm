import { Button } from './Button';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  t: (key: string) => string;
}

export function Pagination({ page, pages, total, limit, onChange, t }: PaginationProps) {
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {start}–{end} {t('common.of')} {total} {t('common.rows')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {t('common.page')} {page} {t('common.of')} {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
