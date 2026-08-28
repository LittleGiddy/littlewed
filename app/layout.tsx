import './globals.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import AuthProvider from '@/components/AuthProvider';
import { Toaster } from 'react-hot-toast';
import PushManager from '@/components/PushManager';
import InstallPrompt from '@/components/InstallPrompt';

export const metadata = {
  title: 'Little Wed',
  description: 'Wedding Management System',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport = {
  themeColor: '#0D4B4B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <AuthProvider>
          {children}
          <PushManager />
          <InstallPrompt />
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#fff',
              color: '#1f2937',
              fontSize: '14px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
            },
            success: {
              iconTheme: { primary: '#0D4B4B', secondary: '#fff' },
              style: { border: '1px solid #0D4B4B', color: '#0D4B4B' },
            },
            error: {
              iconTheme: { primary: '#FF6B5C', secondary: '#fff' },
              style: { border: '1px solid #FF6B5C', color: '#c0392b' },
            },
          }}
        />
      </body>
    </html>
  );
}