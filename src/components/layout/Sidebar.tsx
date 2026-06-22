'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  roles: string[];
}

const DashIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" strokeLinecap="round"/>
    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" strokeLinecap="round"/>
    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" strokeLinecap="round"/>
    <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const BranchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const GroupIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const AttendanceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);
const ScheduleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const LogIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/dashboard', icon: <DashIcon />, label: t('nav.dashboard'), roles: ['super_admin', 'branch_admin', 'teacher', 'student'] },
    { href: '/branches', icon: <BranchIcon />, label: t('nav.branches'), roles: ['super_admin'] },
    { href: '/users', icon: <UsersIcon />, label: t('nav.users'), roles: ['super_admin', 'branch_admin'] },
    { href: '/groups', icon: <GroupIcon />, label: t('nav.groups'), roles: ['super_admin', 'branch_admin', 'teacher', 'student'] },
    { href: '/attendance', icon: <AttendanceIcon />, label: t('nav.attendance'), roles: ['super_admin', 'branch_admin', 'teacher', 'student'] },
    { href: '/schedule', icon: <ScheduleIcon />, label: t('nav.schedule'), roles: ['super_admin', 'branch_admin', 'teacher', 'student'] },
    { href: '/notifications', icon: <BellIcon />, label: t('nav.notifications'), roles: ['super_admin', 'branch_admin', 'teacher', 'student'] },
    { href: '/activity-log', icon: <LogIcon />, label: t('nav.activityLog'), roles: ['super_admin', 'branch_admin'] },
  ];

  const visible = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-60 z-50 flex flex-col',
        'bg-white text-gray-900 border-r border-gray-200',
        'dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800',
        'transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:z-auto lg:flex'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white dark:text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white text-lg tracking-tight">EduCRM</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {visible.map(item => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors',
                      active
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User footer */}
        {user && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-3">
            <Link href="/profile" onClick={onClose} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
              <Avatar firstName={user.first_name} lastName={user.last_name} avatarUrl={user.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.first_name} {user.last_name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role.replace('_', ' ')}</div>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              className="w-full mt-1 flex items-center gap-3 px-2 py-2 rounded text-sm text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('common.logout')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
