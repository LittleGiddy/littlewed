'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, AlertCircle, User, Building2, CreditCard } from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  description: string;
  user: { name: string };
  tenant: { name: string } | null;
  createdAt: string;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/activity')
      .then(res => res.json())
      .then(data => {
        setActivities(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getIcon = (type: string) => {
    if (type.includes('user')) return <User size={16} />;
    if (type.includes('tenant')) return <Building2 size={16} />;
    if (type.includes('credit')) return <CreditCard size={16} />;
    return <Activity size={16} />;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-100 rounded w-1/2 mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map(activity => (
        <div key={activity.id} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(13,79,79,0.08)] flex items-center justify-center text-[#0D4F4F] flex-shrink-0">
            {getIcon(activity.type)}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-800">
              <span className="font-semibold">{activity.user.name}</span>
              {' '}
              {activity.description}
              {activity.tenant && <span className="text-gray-400"> · {activity.tenant.name}</span>}
            </p>
            <p className="text-xs text-gray-400">{new Date(activity.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
      {activities.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
      )}
    </div>
  );
}