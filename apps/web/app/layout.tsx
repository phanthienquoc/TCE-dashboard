import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ios-mobile.css';
import './ui-overrides.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'TCE Dashboard',
  description: 'TCE trading dashboard',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TCE Dashboard' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-white">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
