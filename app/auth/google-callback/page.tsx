'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building, AlertCircle, LogOut } from 'lucide-react';

function GoogleCallbackInner() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get('intent') === 'login' ? 'login' : 'signup';

  const [phase, setPhase] = useState<'checking' | 'needsOrg' | 'redirecting'>('checking');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/check-tenant', { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;

        if (data.hasTenant) {
          setPhase('redirecting');
          if (data.role === 'SUPER_ADMIN') window.location.href = '/admin/dashboard';
          else if (data.role === 'STAFF') window.location.href = '/client/staff/dashboard';
          else window.location.href = '/client/dashboard';
        } else {
          setPhase('needsOrg');
        }
      } catch {
        if (!cancelled) setError('Could not verify your account. Please try again.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, status, router]);

  const subdomainFromName = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please enter an organization name.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: orgName.trim(), subdomain: subdomainFromName(orgName) }),
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        await update(); // refresh the JWT so it now carries the new tenant
        setPhase('redirecting');
        window.location.href = '/client/pending-activation';
      } else {
        setError(data.error || 'Failed to create your organization. Please try again.');
        setSubmitting(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const wrapperStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#F0F4F8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    padding: 24,
  };
  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 24,
    padding: '44px 40px',
    maxWidth: 440,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  };

  if (phase === 'checking' || phase === 'redirecting' || status === 'loading') {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              margin: '0 auto 20px',
              border: '4px solid #E2EAF0',
              borderTopColor: '#0D4B4B',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#7A8FA6', fontSize: 15 }}>
            {phase === 'redirecting' ? 'Taking you to your dashboard…' : 'Checking your account…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(13,75,75,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0D4B4B',
            margin: '0 auto 16px',
          }}
        >
          <Building size={32} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0D1B1B', marginBottom: 8 }}>
          {intent === 'login' ? "Let's finish setting up your account" : 'Create your organization'}
        </h2>
        <p style={{ color: '#7A8FA6', fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
          {intent === 'login' ? (
            <>
              We don't see an organization linked to <strong>{session?.user?.email}</strong> yet. Create one to
              continue — it only takes a second.
            </>
          ) : (
            <>
              You're signed in as <strong>{session?.user?.email}</strong>. Give your organization a name to finish
              creating your account.
            </>
          )}
        </p>

        <form onSubmit={handleCreateOrg} style={{ textAlign: 'left' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#0D4B4B', display: 'block', marginBottom: 6 }}>
            Organization Name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g., ABC Events"
            autoFocus
            disabled={submitting}
            style={{
              width: '100%',
              padding: '13px 15px',
              border: '1.5px solid #E2EAF0',
              borderRadius: 13,
              fontSize: 15,
              outline: 'none',
              fontFamily: 'inherit',
              fontWeight: 500,
              marginBottom: orgName ? 4 : 0,
            }}
          />
          {orgName && (
            <div style={{ fontSize: 11, color: '#9BAAB8', marginBottom: 14 }}>
              Your URL: <strong style={{ color: '#0D4B4B' }}>{subdomainFromName(orgName)}.littlewed.co.tz</strong>
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#C0392B',
                padding: '10px 14px',
                borderRadius: 11,
                fontSize: 13,
                fontWeight: 600,
                marginTop: 10,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !orgName.trim()}
            style={{
              width: '100%',
              marginTop: 18,
              padding: 14,
              border: 'none',
              borderRadius: 13,
              background: 'linear-gradient(135deg, #0D4B4B, #0A3939)',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting || !orgName.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create Organization'}
          </button>
        </form>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: '#7A8FA6',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <LogOut size={14} /> Not you? Sign out
        </button>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallbackInner />
    </Suspense>
  );
}