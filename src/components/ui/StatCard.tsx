import { cn } from '@/lib/utils';
import { colorOf, type AccentColor } from '@/lib/colors';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: AccentColor;
}

export function StatCard({ title, value, icon, color }: StatCardProps) {
  const c = colorOf(color);
  return (
    <div className={cn('relative rounded-lg border overflow-hidden p-5', c.bg, c.border)}>
      <div className={cn('absolute left-0 top-0 h-full w-1', c.solid)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{title}</p>
          <p className={cn('text-2xl font-semibold', c.text)}>{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded flex items-center justify-center text-white', c.solid)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
