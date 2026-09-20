import './globals.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import AuthProvider from '@/components/AuthProvider';
import ToasterWithClose from '@/components/ToasterWithClose';
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
        <ToasterWithClose
          position="bottom-center"
          containerStyle={{
            bottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
          toastOptions={{
            duration: 3200,
            style: {
              background: 'transparent',
              boxShadow: 'none',
              border: 'none',
              borderRadius: '999px',
              padding: 0,
              margin: 0,
              maxWidth: '100%',
            },
            success: { duration: 2200 },
            error: { duration: 4200 },
          }}
        />
      </body>
    </html>
  );
}