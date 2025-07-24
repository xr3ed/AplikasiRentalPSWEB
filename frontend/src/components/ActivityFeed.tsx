'use client';

import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  type: 'transaction' | 'member' | 'session' | 'system';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
  amount?: number;
}

interface ActivityFeedProps {
  className?: string;
  maxItems?: number;
}

const activityIcons = {
  transaction: '💰',
  member: '👤',
  session: '🎮',
  system: '⚙️'
};

const activityColors = {
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400'
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400'
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400'
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400'
  }
};

export const ActivityFeed = ({ className = '', maxItems = 10 }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client-side flag to prevent hydration mismatch
    setIsClient(true);

    fetchActivities();

    // Set up real-time updates (simulate for now)
    const interval = setInterval(() => {
      // In a real app, this would be WebSocket updates
      fetchActivities();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      // Fetch recent transactions
      const transactionsRes = await fetch('http://localhost:3001/api/transactions?limit=5');
      const transactionsData = await transactionsRes.json();

      // Convert transactions to activities
      const transactionActivities: Activity[] = transactionsData.data?.map((tx: any) => ({
        id: `tx-${tx.id}`,
        type: 'transaction' as const,
        title: 'Transaksi Baru',
        description: `${tx.package_name || 'Sesi Reguler'} - Rp ${tx.amount.toLocaleString('id-ID')}`,
        timestamp: tx.created_at,
        icon: '💰',
        color: 'green' as const,
        amount: tx.amount
      })) || [];

      // Add some mock activities for demonstration
      const mockActivities: Activity[] = [
        {
          id: 'member-1',
          type: 'member',
          title: 'Member Baru',
          description: 'Member baru telah terdaftar',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          icon: '👤',
          color: 'blue'
        },
        {
          id: 'session-1',
          type: 'session',
          title: 'Sesi Dimulai',
          description: 'Sesi gaming dimulai di TV #2',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          icon: '🎮',
          color: 'purple'
        },
        {
          id: 'system-1',
          type: 'system',
          title: 'Sistem Update',
          description: 'Sistem berhasil diperbarui',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          icon: '⚙️',
          color: 'yellow'
        }
      ];

      // Combine and sort activities
      const allActivities = [...transactionActivities, ...mockActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxItems);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    // Only calculate time difference on client side to prevent hydration mismatch
    if (!isClient) {
      return '--';
    }

    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari lalu`;
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-400">Live</span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>Belum ada aktivitas</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const colors = activityColors[activity.color];
            
            return (
              <div
                key={activity.id}
                className={`
                  flex items-start space-x-4 p-4 rounded-lg border transition-all duration-300
                  ${colors.bg} ${colors.border}
                  hover:bg-opacity-80 hover:scale-[1.02]
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${colors.bg} ${colors.border} border
                `}>
                  <span className="text-lg">{activity.icon}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {activity.title}
                    </h3>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    {activity.description}
                  </p>
                  {activity.amount && (
                    <div className={`text-xs font-semibold mt-2 ${colors.text}`}>
                      +Rp {activity.amount.toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {activities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button className="w-full text-sm text-red-400 hover:text-red-300 transition-colors">
            Lihat Semua Aktivitas →
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
