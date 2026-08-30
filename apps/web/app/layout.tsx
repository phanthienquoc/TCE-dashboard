import type { Metadata, Viewport } from 'next';
import './globals.css';
import './mobile-sidebar.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'TCE Dashboard',
  description: 'TCE trading dashboard',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'TCE Dashboard' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  themeColor: '#070b12',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-[#070b12]">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
