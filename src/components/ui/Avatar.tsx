import { cn, getInitials } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

export function Avatar({ firstName, lastName, avatarUrl, size = 'md', className }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const src = avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : `${API_BASE}${avatarUrl}`) : null;

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold shrink-0 overflow-hidden',
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      sizes[size],
      className
    )}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${firstName} ${lastName}`} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
