'use client';
import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { ToastProvider } from '@/components/ui/Toast';

import enMessages from '@/messages/en.json';
import ruMessages from '@/messages/ru.json';
import uzMessages from '@/messages/uz.json';

const messages = { en: enMessages, ru: ruMessages, uz: uzMessages };

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider messages={messages}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
