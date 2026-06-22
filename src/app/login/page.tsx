'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { locales, localeNames, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.invalidCredentials');
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 dark:bg-gray-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">EduCRM</span>
        </div>

        <div>
          <blockquote className="text-gray-300 text-2xl font-light leading-relaxed mb-6">
            "Manage your educational center with clarity, precision, and insight."
          </blockquote>
          <div className="flex gap-6 text-gray-500 text-sm">
            <div>
              <div className="text-white text-2xl font-semibold">100%</div>
              <div>Attendance Tracking</div>
            </div>
            <div>
              <div className="text-white text-2xl font-semibold">Multi</div>
              <div>Branch Support</div>
            </div>
            <div>
              <div className="text-white text-2xl font-semibold">Real</div>
              <div>Time Analytics</div>
            </div>
          </div>
        </div>

        <div className="text-gray-600 text-sm">
          © {new Date().getFullYear()} EduCRM. All rights reserved.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        {/* Controls */}
        <div className="flex justify-end items-center gap-3 p-4">
          {locales.map(l => (
            <button
              key={l}
              onClick={() => setLocale(l as Locale)}
              className={cn(
                'text-sm px-3 py-1 rounded transition-colors',
                l === locale
                  ? 'bg-gray-900 text-white font-medium dark:bg-white dark:text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              {localeNames[l as Locale]}
            </button>
          ))}
          <button
            onClick={toggleTheme}
            className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
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
        </div>

        {/* Login form */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white dark:text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                </svg>
              </div>
              <span className="font-semibold text-xl">EduCRM</span>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">{t('auth.loginTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{t('auth.loginSubtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label={t('common.username')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="superadmin"
                autoComplete="username"
                required
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('common.password')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {loading ? t('auth.loggingIn') : t('auth.login')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
