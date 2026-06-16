'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

interface DeleteTenantButtonProps {
  tenantId: string;
  tenantName: string;
}

export default function DeleteTenantButton({ tenantId, tenantName }: DeleteTenantButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${tenantName}" and ALL its data? This action cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/delete`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete');
      }
    } catch (error) {
      alert('Error deleting organisation');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="delete-link"
    >
      <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}