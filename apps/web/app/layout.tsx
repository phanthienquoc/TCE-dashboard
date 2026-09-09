import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ios-mobile.css';
import './ui-overrides.css';
import './mobile-design-system.css';
import './mobile-legacy-compat.css';
import './theme-polish.css';
import './theme-input-fix.css';
import './mobile-dashboard-polish.css';
import './engine/form-controls.css';
import './positions-ui-fix.css';
import './positions/list-view.css';
import './position-theme.css';
import '../shareComponent/data-display.css';
import '../shareComponent/account-card.css';
import './order-theme.css';
import './app-spacing.css';
import './dashboard-layout.css';
import './mobile-command-center.css';
import './tce-mobile-dark-theme.css';
import './more-dark-theme-fix.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'TCE Dashboard',
  description: 'TCE trading dashboard',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'TCE Dashboard' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  themeColor: '#071016',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
