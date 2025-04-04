import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppToastProvider } from '@/components/providers/ToastProvider';
import { Providers } from '@/lib/providers';
import { Metadata } from 'next';

// Properly initialize Inter font with variable name
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Debate-able',
  description: 'AI-powered debate platform for exploring different perspectives',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-black antialiased">
        <Providers>
          <ThemeProvider>
            <AppToastProvider>
              {children}
            </AppToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
