'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ManageTenantPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/tenants/${id}`, { credentials: 'include' })
      .then(res => res.json())
      .then(setTenant);
  }, [id]);

const toggleStatus = async () => {
  await fetch(`/api/admin/tenants/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: tenant.subscriptionStatus === 'active' ? 'inactive' : 'active' }),
    credentials: 'include',
  });
  setTenant({ ...tenant, subscriptionStatus: tenant.subscriptionStatus === 'active' ? 'inactive' : 'active' });
};

const addCredit = async () => {
  const amount = parseInt(creditAmount);
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  setLoading(true);
  const res = await fetch(`/api/admin/tenants/${id}/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
    credentials: 'include',
  });
  if (res.ok) {
    setTenant({ ...tenant, credits: (tenant.credits || 0) + amount });
    setCreditAmount('');
  } else {
    const error = await res.json();
    alert(`Failed: ${error.error}`);
  }
  setLoading(false);
};

  if (!tenant) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manage {tenant.name}</h1>
      <div className="space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <p><strong>Status:</strong> {tenant.subscriptionStatus}</p>
          <button onClick={toggleStatus} className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded">
            {tenant.subscriptionStatus === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p><strong>Credit Balance (TZS):</strong> {tenant.credits ?? 0}</p>
          <input
            type="number"
            value={creditAmount}
            onChange={e => setCreditAmount(e.target.value)}
            placeholder="Amount in TZS"
            className="border p-2 mr-2 rounded"
          />
          <button onClick={addCredit} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
            {loading ? 'Adding...' : 'Add Credit'}
          </button>
        </div>
      </div>
    </div>
  );
}