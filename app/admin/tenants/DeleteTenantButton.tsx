'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

interface DeleteTenantButtonProps {
  tenantId: string;
  tenantName: string;
}

export default function DeleteTenantButton({ tenantId, tenantName }: DeleteTenantButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const ok = await confirmToast({
      title: `Delete "${tenantName}"?`,
      message: 'This action cannot be undone. It will delete the tenant and ALL its data.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/delete`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete');
      }
    } catch {
      toast.error('Error deleting organisation');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDeleting ? (
        <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
      ) : (
        <Trash2 size={13} />
      )}
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}
