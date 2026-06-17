'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, Users, RefreshCw, XCircle, ShieldCheck, Clock } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  tenant: { name: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else toast.error(data.error || 'Failed to load users');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    setProcessing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'PATCH', credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${action}d successfully`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
      } else {
        toast.error(data.error || `Failed to ${action} user`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const inactiveUsers = users.filter(u => !u.isActive);
  const activeUsers = users.filter(u => u.isActive);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .au-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 860px; margin: 0 auto;
          padding: 48px 24px 64px;
          animation: auFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes auFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ── */
        .au-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 16px;
          margin-bottom: 32px; flex-wrap: wrap;
        }

        .au-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .au-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }

        .au-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.4px; margin: 0 0 6px;
        }
        .au-title span { color: #E8A598; }
        .au-subtitle { font-size: 14px; color: #7A8FA6; margin: 0; }

        .au-refresh-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 11px 18px; border-radius: 13px;
          border: 1.5px solid #E2EAF0; background: white;
          color: #4A6072; font-size: 13.5px; font-weight: 700;
          font-family: inherit; cursor: pointer; flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          transition: border-color 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
          align-self: flex-start;
        }
        .au-refresh-btn:hover {
          border-color: #0D4F4F; color: #0D4F4F;
          transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13,79,79,0.1);
        }
        .au-refresh-btn:active { transform: translateY(0); }
        .au-refresh-btn.spinning svg { animation: auSpin 0.8s linear infinite; }
        @keyframes auSpin { to { transform: rotate(360deg); } }

        /* ── Stats row ── */
        .au-stats {
          display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;
        }

        .au-stat {
          display: flex; align-items: center; gap: 10px;
          background: white; border: 1.5px solid #E2EAF0;
          border-radius: 14px; padding: 13px 18px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04); flex: 1; min-width: 140px;
        }
        .au-stat-icon {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .au-stat-num { font-size: 22px; font-weight: 900; color: #0D1B1B; font-family: 'Playfair Display', serif; line-height: 1; }
        .au-stat-label { font-size: 11.5px; color: #9BAAB8; font-weight: 600; margin-top: 2px; }

        /* ── Section card ── */
        .au-section {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05);
          margin-bottom: 24px;
          animation: auCardIn 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes auCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .au-section-bar { height: 4px; }
        .au-section-bar.pending { background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .au-section-bar.active  { background: linear-gradient(90deg, #1A7A4A, #3AB795); }

        .au-section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px; border-bottom: 1.5px solid #F0F4F8;
        }

        .au-section-title-wrap { display: flex; align-items: center; gap: 10px; }
        .au-section-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .au-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B; letter-spacing: -0.2px;
        }

        .au-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
        }
        .au-badge.pending { color: #C07A20; background: rgba(192,122,32,0.1); border: 1px solid rgba(192,122,32,0.2); }
        .au-badge.active  { color: #1A7A4A; background: rgba(26,122,74,0.08); border: 1px solid rgba(26,122,74,0.18); }

        /* ── User rows ── */
        .au-row {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 24px; border-bottom: 1px solid #F7F9FB;
          transition: background 0.15s;
          animation: auRowIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .au-row:last-child { border-bottom: none; }
        .au-row:hover { background: #F7FAFA; }

        @keyframes auRowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Avatar */
        .au-avatar {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 800; color: white;
          font-family: 'Playfair Display', serif;
        }
        .au-avatar.active-user {
          background: linear-gradient(135deg, #1A7A4A, #145C38);
        }

        /* User info */
        .au-user-info { flex: 1 1 0; min-width: 0; }
        .au-user-name {
          font-size: 14px; font-weight: 700; color: #0D1B1B;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .au-user-email {
          font-size: 12.5px; color: #7A8FA6; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .au-user-meta {
          font-size: 11.5px; color: #B0BEC8; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Action button */
        .au-action-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 16px; border: none; border-radius: 11px;
          font-size: 13px; font-weight: 700; font-family: inherit;
          cursor: pointer; flex-shrink: 0; white-space: nowrap;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          position: relative; overflow: hidden;
        }
        .au-action-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .au-action-btn:hover:not(:disabled)::after { opacity: 1; }
        .au-action-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .au-action-btn:active:not(:disabled) { transform: translateY(0); }
        .au-action-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .au-action-btn.activate {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; box-shadow: 0 3px 10px rgba(13,79,79,0.3);
        }
        .au-action-btn.activate:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(13,79,79,0.38); }

        .au-action-btn.deactivate {
          background: linear-gradient(135deg, #C0392B, #A93226);
          color: white; box-shadow: 0 3px 10px rgba(192,57,43,0.28);
        }
        .au-action-btn.deactivate:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(192,57,43,0.36); }

        .au-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: auSpin 0.7s linear infinite; flex-shrink: 0;
        }

        /* ── Empty state ── */
        .au-empty {
          padding: 44px 24px; text-align: center;
        }
        .au-empty-icon {
          width: 52px; height: 52px; border-radius: 15px; margin: 0 auto 14px;
          background: rgba(13,79,79,0.06); border: 1.5px solid rgba(13,79,79,0.1);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .au-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B; margin-bottom: 5px;
        }
        .au-empty-sub { font-size: 13px; color: #9BAAB8; }

        /* ── Loading skeleton ── */
        .au-skeleton-row {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 24px; border-bottom: 1px solid #F7F9FB;
        }
        .au-skeleton { background: #F0F4F8; border-radius: 8px; animation: auShimmer 1.4s ease-in-out infinite; }
        @keyframes auShimmer {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }

        @media (max-width: 560px) {
          .au-wrap { padding: 28px 16px 48px; }
          .au-title { font-size: 26px; }
          .au-row { padding: 14px 16px; gap: 10px; }
          .au-section-header { padding: 14px 16px; }
          .au-action-btn span { display: none; }
          .au-action-btn { padding: 9px 11px; }
          .au-stats { gap: 10px; }
        }
      `}</style>

      <div className="au-wrap">

        {/* Header */}
        <div className="au-header">
          <div>
            <div className="au-eyebrow"><div className="au-eyebrow-dot" />Admin Panel</div>
            <h1 className="au-title">User <span>Management</span></h1>
            <p className="au-subtitle">Activate or deactivate client accounts.</p>
          </div>
          <button
            className={`au-refresh-btn ${loading ? 'spinning' : ''}`}
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="au-stats">
          <div className="au-stat">
            <div className="au-stat-icon" style={{ background: 'rgba(192,122,32,0.1)' }}>
              <Clock size={17} style={{ color: '#C07A20' }} />
            </div>
            <div>
              <div className="au-stat-num">{loading ? '—' : inactiveUsers.length}</div>
              <div className="au-stat-label">Pending</div>
            </div>
          </div>
          <div className="au-stat">
            <div className="au-stat-icon" style={{ background: 'rgba(26,122,74,0.08)' }}>
              <ShieldCheck size={17} style={{ color: '#1A7A4A' }} />
            </div>
            <div>
              <div className="au-stat-num">{loading ? '—' : activeUsers.length}</div>
              <div className="au-stat-label">Active</div>
            </div>
          </div>
          <div className="au-stat">
            <div className="au-stat-icon" style={{ background: 'rgba(13,79,79,0.08)' }}>
              <Users size={17} style={{ color: '#0D4F4F' }} />
            </div>
            <div>
              <div className="au-stat-num">{loading ? '—' : users.length}</div>
              <div className="au-stat-label">Total Users</div>
            </div>
          </div>
        </div>

        {/* ── Pending section ── */}
        <div className="au-section" style={{ animationDelay: '60ms' }}>
          <div className="au-section-bar pending" />
          <div className="au-section-header">
            <div className="au-section-title-wrap">
              <div className="au-section-icon" style={{ background: 'rgba(192,122,32,0.1)' }}>
                <Clock size={16} style={{ color: '#C07A20' }} />
              </div>
              <div className="au-section-title">Pending Activation</div>
            </div>
            <div className="au-badge pending">{inactiveUsers.length} user{inactiveUsers.length !== 1 ? 's' : ''}</div>
          </div>

          {loading ? (
            [1, 2].map(i => (
              <div key={i} className="au-skeleton-row">
                <div className="au-skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="au-skeleton" style={{ height: 13, width: '45%' }} />
                  <div className="au-skeleton" style={{ height: 11, width: '65%' }} />
                </div>
                <div className="au-skeleton" style={{ height: 36, width: 90, borderRadius: 11 }} />
              </div>
            ))
          ) : inactiveUsers.length === 0 ? (
            <div className="au-empty">
              <div className="au-empty-icon"><CheckCircle size={22} /></div>
              <div className="au-empty-title">All caught up</div>
              <p className="au-empty-sub">No accounts are waiting for activation.</p>
            </div>
          ) : (
            inactiveUsers.map((user, i) => (
              <div key={user.id} className="au-row" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="au-avatar">
                  {user.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="au-user-info">
                  <div className="au-user-name">{user.name}</div>
                  <div className="au-user-email">{user.email}</div>
                  <div className="au-user-meta">
                    {user.tenant?.name ?? 'No tenant'} · Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  className="au-action-btn activate"
                  onClick={() => toggleActive(user.id, user.isActive)}
                  disabled={processing === user.id}
                >
                  {processing === user.id
                    ? <div className="au-spinner" />
                    : <CheckCircle size={14} />
                  }
                  <span>Activate</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── Active users section ── */}
        <div className="au-section" style={{ animationDelay: '120ms' }}>
          <div className="au-section-bar active" />
          <div className="au-section-header">
            <div className="au-section-title-wrap">
              <div className="au-section-icon" style={{ background: 'rgba(26,122,74,0.08)' }}>
                <ShieldCheck size={16} style={{ color: '#1A7A4A' }} />
              </div>
              <div className="au-section-title">Active Users</div>
            </div>
            <div className="au-badge active">{activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''}</div>
          </div>

          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="au-skeleton-row">
                <div className="au-skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="au-skeleton" style={{ height: 13, width: '40%' }} />
                  <div className="au-skeleton" style={{ height: 11, width: '60%' }} />
                </div>
                <div className="au-skeleton" style={{ height: 36, width: 100, borderRadius: 11 }} />
              </div>
            ))
          ) : activeUsers.length === 0 ? (
            <div className="au-empty">
              <div className="au-empty-icon"><Users size={22} /></div>
              <div className="au-empty-title">No active users</div>
              <p className="au-empty-sub">Activate a pending account to get started.</p>
            </div>
          ) : (
            activeUsers.map((user, i) => (
              <div key={user.id} className="au-row" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="au-avatar active-user">
                  {user.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="au-user-info">
                  <div className="au-user-name">{user.name}</div>
                  <div className="au-user-email">{user.email}</div>
                  <div className="au-user-meta">{user.tenant?.name ?? 'No tenant'}</div>
                </div>
                <button
                  className="au-action-btn deactivate"
                  onClick={() => toggleActive(user.id, user.isActive)}
                  disabled={processing === user.id}
                >
                  {processing === user.id
                    ? <div className="au-spinner" />
                    : <XCircle size={14} />
                  }
                  <span>Deactivate</span>
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  );
}