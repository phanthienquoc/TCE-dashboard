import './globals.css';
import ToastHost from './ToastHost';
import ClientOnly from './ClientOnly';
import { AuthProvider } from '../lib/auth-context';

export const metadata = {
  title: 'TCE Dashboard',
  description: 'Treasury Cash Extraction dashboard',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0b0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <ClientOnly>
          <AuthProvider>{children}</AuthProvider>
        </ClientOnly>
        <ToastHost />
      </body>
    </html>
  );
}
