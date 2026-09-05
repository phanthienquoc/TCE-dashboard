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
import '../shareComponent/data-display.css';
import '../shareComponent/account-card.css';
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
  themeColor: '#0b1020',
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
