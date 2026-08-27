'use client';

import { useEffect, useState } from 'react';
import { Activity, User, Building2, CreditCard, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  user: { name: string };
  tenant: { name: string } | null;
  createdAt: string;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/activity')
      .then(res => res.json())
      .then(data => { setActivities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getIcon = (type: string) => {
    if (type.includes('user')) return <User size={14} className="text-blue-600" />;
    if (type.includes('tenant')) return <Building2 size={14} className="text-[#0D4B4B]" />;
    if (type.includes('credit')) return <CreditCard size={14} className="text-violet-600" />;
    return <Activity size={14} className="text-gray-600" />;
  };

  const getIconBg = (type: string) => {
    if (type.includes('user')) return 'bg-blue-50';
    if (type.includes('tenant')) return 'bg-[#0D4B4B]/5';
    if (type.includes('credit')) return 'bg-violet-50';
    return 'bg-gray-50';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 rounded-full w-3/4" />
              <div className="h-2.5 bg-gray-50 rounded-full w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.slice(0, 8).map(activity => (
        <div key={activity.id} className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg ${getIconBg(activity.type)} flex items-center justify-center flex-shrink-0`}>
            {getIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 leading-snug">
              <span className="font-semibold text-gray-900">{activity.user.name}</span>
              {' '}
              <span className="text-gray-500">{activity.description}</span>
              {activity.tenant && <span className="text-gray-400"> &middot; {activity.tenant.name}</span>}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={10} className="text-gray-300" />
              <p className="text-[11px] text-gray-400">{new Date(activity.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ))}
      {activities.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No activity yet</p>
        </div>
      )}
    </div>
  );
}
