import './globals.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/playfair-display/900.css';
// Card designer faces. The server renders card text from the TTF outlines in
// public/fonts, so the browser must load the very same faces or the designer
// preview and the delivered card disagree. Latin subsets only: card names are
// Latin, and these weights would otherwise ship for every visitor.
import '@fontsource/dancing-script/latin-400.css';
import '@fontsource/dancing-script/latin-700.css';
import '@fontsource/great-vibes/latin-400.css';
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
            duration: 3000,
            style: {
              background: 'transparent',
              boxShadow: 'none',
              border: 'none',
              borderRadius: '999px',
              padding: 0,
              margin: 0,
              maxWidth: '100%',
            },
            success: { duration: 3000 },
            error: { duration: 4200 },
          }}
        />
      </body>
    </html>
  );
}