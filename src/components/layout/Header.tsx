'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/lib/api';
import { locales, localeNames, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuToggle: () => void;
}

interface SearchResult {
  users: Array<{ id: string; username: string; first_name: string; last_name: string; role: string }>;
  groups: Array<{ id: string; name: string; branch_name: string }>;
  branches: Array<{ id: string; name: string }>;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Dropdown holati uchun yangi state
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Notification fetch (o‘zgarmagan)
  useEffect(() => {
    const fetchNotif = async () => {
      try {
        const data = await api.get<{ unreadCount: number }>('/api/notifications', { is_read: false, limit: 1 });
        setNotifCount(data.unreadCount);
      } catch {}
    };
    if (user) { fetchNotif(); const i = setInterval(fetchNotif, 30000); return () => clearInterval(i); }
  }, [user]);

  // Qidiruv dropdownini tashqi bosganda yopish (o‘zgarmagan)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Til dropdownini tashqi bosganda yopish
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Qidiruv (o‘zgarmagan)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.length >= 2) {
        try {
          const data = await api.get<SearchResult>('/api/dashboard/search', { q: search });
          setSearchResults(data);
          setSearchOpen(true);
        } catch {}
      } else {
        setSearchResults(null);
        setSearchOpen(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasResults = searchResults && (
    searchResults.users.length > 0 || searchResults.groups.length > 0 || searchResults.branches.length > 0
  );

  // Tilni tanlash funksiyasi (dropdownni yopadi)
  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setLangOpen(false);
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Menu toggle (mobile) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search (o‘zgarmagan) */}
      <div className="flex-1 max-w-lg relative" ref={searchRef}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Search dropdown (o‘zgarmagan) */}
        {searchOpen && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 max-h-80 overflow-y-auto">
            {/* ... qidiruv natijalari ... */}
            {searchResults!.users.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">{t('nav.users')}</div>
                {searchResults!.users.map(u => (
                  <button key={u.id} onClick={() => { router.push(`/users/${u.id}`); setSearch(''); setSearchOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{u.first_name} {u.last_name}</span>
                    <span className="text-gray-400">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults!.groups.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">{t('nav.groups')}</div>
                {searchResults!.groups.map(g => (
                  <button key={g.id} onClick={() => { router.push(`/groups/${g.id}`); setSearch(''); setSearchOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="font-medium text-gray-900 dark:text-white">{g.name}</span>
                    {g.branch_name && <span className="text-gray-400 ml-2">— {g.branch_name}</span>}
                  </button>
                ))}
              </div>
            )}
            {searchResults!.branches.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">{t('nav.branches')}</div>
                {searchResults!.branches.map(b => (
                  <button key={b.id} onClick={() => { router.push(`/branches`); setSearch(''); setSearchOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="font-medium text-gray-900 dark:text-white">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Til tanlash – bosganda ochiladigan dropdown */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(prev => !prev)}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            {locale.toUpperCase()}
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-28">
              {locales.map(l => (
                <button
                  key={l}
                  onClick={() => handleLocaleChange(l as Locale)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    l === locale
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  {localeNames[l as Locale]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle (o‘zgarmagan) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {/* Notifications (o‘zgarmagan) */}
        <Link href="/notifications" className="relative p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}