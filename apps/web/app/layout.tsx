import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'TCE Dashboard', description: 'TCE trading dashboard' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
