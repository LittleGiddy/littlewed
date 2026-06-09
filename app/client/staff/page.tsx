'use client';
import { useEffect, useState } from 'react';
import { UserPlus, Trash2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/staff', { credentials: 'include' });
      if (res.ok) {
        setStaff(await res.json());
      }
      setLoading(false);
    } catch {
      setError('Failed to load staff');
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      if (res.ok) {
        setShowForm(false);
        setEmail('');
        setPassword('');
        setName('');
        loadStaff();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add staff');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const deleteStaff = async (id: string) => {
    if (confirm('Delete this staff member?')) {
      try {
        await fetch(`/api/staff/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        loadStaff();
      } catch {
        setError('Failed to delete staff');
      }
    }
  };

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Back link */
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          text-decoration: none; margin-bottom: 24px;
          padding: 7px 14px;
          background: rgba(13,79,79,0.08);
          border: 1px solid rgba(13,79,79,0.12);
          border-radius: 10px;
          transition: background 0.15s;
        }
        .back-link:hover { background: rgba(13,79,79,0.14); }

        /* Header */
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 28px;
        }

        .page-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
        }
        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px;
        }
        .page-title span { color: #E8A598; }

        .add-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 22px; border: none; border-radius: 14px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative; overflow: hidden;
        }
        .add-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .add-btn:hover::after { opacity: 1; }
        .add-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }

        /* Form modal */
        .form-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px;
          animation: fadeInOverlay 0.2s ease-out;
        }

        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .form-card {
          background: white; border-radius: 20px; width: 100%; max-width: 420px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .form-header {
          padding: 24px 24px 0;
          border-bottom: 1.5px solid #F0F4F8;
        }

        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 800; color: #0D1B1B;
        }

        .form-body { padding: 24px; }

        /* Form fields */
        .field-wrap { position: relative; margin-bottom: 16px; }
        .field-label {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-size: 13px; color: #9BAAB8; pointer-events: none;
          background: white; padding: 0 4px; font-weight: 500;
          transition: top 0.2s, font-size 0.2s, color 0.2s;
        }
        .field-label.up { top: 0; font-size: 10px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.2px; }

        .field-input {
          width: 100%; padding: 14px; border: 1.5px solid #E2EAF0;
          border-radius: 13px; font-size: 14px; font-family: inherit;
          outline: none; color: #0D1B1B; background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        .pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #9BAAB8;
          display: flex; align-items: center; padding: 4px; transition: color 0.15s;
        }
        .pw-eye:hover { color: #0D4F4F; }

        .form-actions {
          display: flex; gap: 10px; margin-top: 20px;
        }

        .btn-submit {
          flex: 1; padding: 13px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-submit:hover:not(:disabled) { transform: translateY(-2px); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-cancel {
          flex: 1; padding: 13px; border: 1.5px solid #E2EAF0;
          border-radius: 13px; background: white; color: #4A6072;
          font-size: 14px; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .btn-cancel:hover { border-color: #0D4F4F; background: rgba(13,79,79,0.04); }

        .spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Error */
        .err-box {
          background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B;
          padding: 12px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
          margin-bottom: 20px; display: flex; gap: 8px; align-items: flex-start;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-5px); }
          60%      { transform: translateX(5px); }
        }

        /* Staff table card */
        .table-card {
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.55s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .table-header {
          display: flex; align-items: center; padding: 16px 22px;
          border-bottom: 1.5px solid #F0F4F8;
        }

        .table-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B;
        }

        .table-badge {
          margin-left: auto;
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); padding: 4px 12px;
          border-radius: 20px;
        }

        /* Table */
        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        thead tr {
          border-bottom: 1.5px solid #F0F4F8;
        }

        th {
          padding: 14px 22px; text-align: left;
          font-size: 11px; font-weight: 700; color: #9BAAB8;
          letter-spacing: 0.5px; text-transform: uppercase;
        }

        tbody tr {
          border-bottom: 1px solid #F7F9FB;
          transition: background 0.15s;
        }
        tbody tr:hover { background: #F7FAFA; }
        tbody tr:last-child { border-bottom: none; }

        td {
          padding: 14px 22px; color: #4A6072; font-weight: 500;
        }

        .staff-name {
          color: #0D1B1B; font-weight: 700;
        }

        .staff-email {
          font-size: 13px; color: #9BAAB8;
        }

        .staff-date {
          font-size: 13px; color: #9BAAB8;
        }

        .delete-btn {
          background: none; border: none; cursor: pointer;
          color: #E05C5C; transition: color 0.15s;
          padding: 4px; display: inline-flex;
        }
        .delete-btn:hover { color: #C0392B; }

        .empty-state {
          padding: 56px 24px; text-align: center;
        }

        .empty-icon {
          width: 60px; height: 60px; border-radius: 16px;
          background: rgba(13,79,79,0.07);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px; font-size: 24px;
        }

        .empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 800; color: #0D1B1B;
          margin-bottom: 6px;
        }

        .empty-sub { font-size: 13.5px; color: #9BAAB8; }

        .loading-spinner {
          width: 44px; height: 44px; border: 3px solid #E2EAF0;
          border-top-color: #0D4F4F; border-radius: 50%;
          animation: spin 0.7s linear infinite; margin: 32px auto;
        }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; }
          .page-title { font-size: 26px; }
          .add-btn { width: 100%; justify-content: center; }
          th, td { padding: 12px 16px; font-size: 13px; }
        }
      `}</style>

      {/* ✅ Removed .wrap div wrapper */}
      <div>

        {/* Back */}
        <Link href="/client/dashboard" className="back-link">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Management</div>
            <div className="page-title">Staff <span>Members</span></div>
          </div>
          <button className="add-btn" onClick={() => setShowForm(true)}>
            <UserPlus size={16} /> Add Staff
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="err-box">
            ⚠️ {error}
            <button
              onClick={() => setError('')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#C0392B' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Add form modal */}
        {showForm && (
          <div className="form-overlay" onClick={() => setShowForm(false)}>
            <div className="form-card" onClick={e => e.stopPropagation()}>
              <div className="form-header">
                <h2 className="form-title">Add Staff Member</h2>
              </div>
              <div className="form-body">
                {error && (
                  <div className="err-box" style={{ marginBottom: 14 }}>
                    ⚠️ {error}
                  </div>
                )}
                <form onSubmit={addStaff}>

                  <div className="field-wrap">
                    <label className={`field-label ${focused === 'name' ? 'up' : ''}`}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      className="field-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onFocus={() => setFocused('name')}
                      onBlur={() => setFocused(null)}
                    />
                  </div>

                  <div className="field-wrap">
                    <label className={`field-label ${focused === 'email' ? 'up' : ''}`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="field-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                    />
                  </div>

                  <div className="field-wrap">
                    <label className={`field-label ${focused === 'password' ? 'up' : ''}`}>
                      Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="field-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      className="pw-eye"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-submit" disabled={submitting}>
                      {submitting ? (
                        <><div className="spinner" /> Creating…</>
                      ) : (
                        <>Create Staff</>
                      )}
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Staff table */}
        {loading ? (
          <div className="loading-spinner" />
        ) : (
          <div className="table-card">
            <div className="table-header">
              <h2 className="table-title">Team Members</h2>
              <div className="table-badge">{staff.length} staff</div>
            </div>

            {staff.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <div className="empty-title">No staff members yet</div>
                <p className="empty-sub">Add your first team member to get started.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th style={{ width: 40 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id}>
                        <td className="staff-name">{s.name}</td>
                        <td className="staff-email">{s.email}</td>
                        <td className="staff-date">
                          {new Date(s.createdAt).toLocaleDateString('en-TZ', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td>
                          <button
                            className="delete-btn"
                            onClick={() => deleteStaff(s.id)}
                            title="Delete staff member"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
