import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Building2, Users, CreditCard, Activity, ArrowRight, CheckCircle, Zap } from 'lucide-react';

export default async function AdminDashboard() {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/login');

  const tenants = await prisma.tenant.findMany({
    include: { users: true },
    orderBy: { createdAt: 'desc' },
  });

  const stats = {
    totalTenants: tenants.length,
    totalUsers: tenants.reduce((acc, t) => acc + t.users.length, 0),
    activeSubscriptions: tenants.filter(t => t.subscriptionStatus === 'active').length,
  };

  // Logo component (same as signup)
  const Logo = () => (
    <img src="/Little Wed Logo.svg" alt="Little Wed" style={{ display: 'block', width: '140px', height: 'auto' }} />
  );

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body { background: #F0F4F8; }

        .admin-page {
          min-height: 100vh;
          background: #F0F4F8;
          padding: 24px 20px;
        }

        .container {
          max-width: 1280px;
          margin: 0 auto;
        }

        /* Header */
        .header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          gap: 16px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 14px rgba(13,79,79,0.25);
        }

        .brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 800;
          color: #0D4F4F;
          letter-spacing: -0.3px;
        }

        .welcome {
          background: white;
          padding: 8px 20px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 600;
          color: #0D4F4F;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          backdrop-filter: blur(2px);
        }

        /* Stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .stat-card {
          background: white;
          border-radius: 24px;
          padding: 20px 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(0,0,0,0.04);
        }

        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.08);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          background: #F0F4F8;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info h3 {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #7A8FA6;
          margin-bottom: 4px;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 800;
          color: #0D4F4F;
          line-height: 1.1;
        }

        /* Action bar */
        .action-bar {
          margin-bottom: 28px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 40px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 12px rgba(13,79,79,0.3);
          text-decoration: none;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(13,79,79,0.35);
        }

        /* Table */
        .table-wrapper {
          background: white;
          border-radius: 28px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.05);
          overflow: hidden;
          backdrop-filter: blur(2px);
        }

        .table-header {
          padding: 18px 24px;
          border-bottom: 1px solid #EFF3F6;
          background: #FCFDFE;
        }

        .table-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1F2A3E;
          letter-spacing: -0.2px;
        }

        .tenant-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .tenant-table th {
          text-align: left;
          padding: 16px 20px;
          background: #FAFBFD;
          font-weight: 600;
          color: #4A6072;
          border-bottom: 1px solid #EEF2F6;
        }

        .tenant-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #F0F4F8;
          color: #1E2A3A;
          font-weight: 500;
        }

        .tenant-table tr:hover td {
          background: #F9FCFE;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .status-active {
          background: #E0F2F1;
          color: #0D4F4F;
        }

        .status-inactive {
          background: #FEF2F2;
          color: #C0392B;
        }

        .plan-badge {
          background: #F0F4F8;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #4A6072;
        }

        .manage-link {
          color: #0D4F4F;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .manage-link:hover {
          opacity: 0.7;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .admin-page { padding: 16px; }
          .stats-grid { gap: 12px; }
          .stat-card { padding: 16px; }
          .stat-icon { width: 44px; height: 44px; }
          .stat-number { font-size: 24px; }
          .tenant-table th, .tenant-table td { padding: 12px 16px; }
          .table-header { padding: 14px 16px; }
        }
      `}</style>

      <div className="admin-page">
        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="brand">
              <div className="brand-icon">
                <Logo />
              </div>
              <div className="brand-name">Super Admin</div>
            </div>
            <div className="welcome">
              Welcome, {(session.user as any).name || session.user.email}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Building2 size={26} strokeWidth={1.5} color="#0D4F4F" />
              </div>
              <div className="stat-info">
                <h3>Organisations</h3>
                <div className="stat-number">{stats.totalTenants}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={26} strokeWidth={1.5} color="#0D4F4F" />
              </div>
              <div className="stat-info">
                <h3>Users</h3>
                <div className="stat-number">{stats.totalUsers}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <CreditCard size={26} strokeWidth={1.5} color="#0D4F4F" />
              </div>
              <div className="stat-info">
                <h3>Active Subscriptions</h3>
                <div className="stat-number">{stats.activeSubscriptions}</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="action-bar">
            <Link href="/admin/tenants/new" className="btn-primary">
              + New Organisation <ArrowRight size={14} />
            </Link>
          </div>

          {/* Tenants Table */}
          <div className="table-wrapper">
            <div className="table-header">
              <h2>All organisations</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Subdomain</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Users</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => (
                    <tr key={tenant.id}>
                      <td style={{ fontWeight: 600 }}>{tenant.name}</td>
                      <td>{tenant.subdomain}</td>
                      <td><span className="plan-badge">{tenant.plan}</span></td>
                      <td>
                        <span className={`status-badge ${tenant.subscriptionStatus === 'active' ? 'status-active' : 'status-inactive'}`}>
                          {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{tenant.users.length}</td>
                      <td>
                        <Link href={`/admin/tenants/${tenant.id}/manage`} className="manage-link">
                          Manage <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#9BAAB8' }}>No organisations yet. Create the first one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}