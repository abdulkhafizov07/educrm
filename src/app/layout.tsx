import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'EduCRM – Education Management System',
  description: 'Production-ready Education CRM for managing students, teachers, branches, and attendance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased font-sans bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
