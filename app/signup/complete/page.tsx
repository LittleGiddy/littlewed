// app/signup/complete/page.tsx
// Google users land here after OAuth. Reads business_name + subdomain
// from localStorage, creates the tenant, then redirects to pending-activation.

'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignupCompletePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState('Setting up your workspace…');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/login');
      return;
    }

    const business_name = localStorage.getItem('signup_business_name');
    const subdomain     = localStorage.getItem('signup_subdomain');

    if (!business_name || !subdomain) {
      // No workspace data — user may have logged in via Google directly
      // without going through signup step 1. Send them to dashboard.
      router.push('/client/dashboard');
      return;
    }

    const createTenant = async () => {
      try {
        const res = await fetch('/api/register/complete-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_name, subdomain }),
          credentials: 'include',
        });
        const data = await res.json();

        if (res.ok) {
          localStorage.removeItem('signup_business_name');
          localStorage.removeItem('signup_subdomain');
          setMessage('Workspace created! Redirecting…');
          router.push('/client/pending-activation');
        } else {
          setError(data.error || 'Failed to create workspace.');
        }
      } catch {
        setError('Network error. Please try again.');
      }
    };

    createTenant();
  }, [session, status, router]);

  return (
    <div style={{
      minHeight: '100vh', background: '#F0F4F8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '48px 40px',
        maxWidth: 420, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        {error ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#0D1B1B', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: '#C0392B', fontSize: 14, marginBottom: 20 }}>{error}</p>
            <a href="/signup" style={{
              display: 'inline-block', padding: '11px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg, #0D4F4F, #0A3D3D)',
              color: 'white', fontWeight: 700, textDecoration: 'none', fontSize: 14,
            }}>
              Try again
            </a>
          </>
        ) : (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 20px',
              border: '4px solid #E2EAF0', borderTopColor: '#0D4F4F',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#7A8FA6', fontSize: 15 }}>{message}</p>
          </>
        )}
      </div>
    </div>
  );
}