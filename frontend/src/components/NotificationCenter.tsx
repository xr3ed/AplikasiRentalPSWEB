'use client';

import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationCenterProps {
  className?: string;
}

const notificationStyles = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'ℹ️',
    color: 'text-blue-400'
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: '✅',
    color: 'text-green-400'
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: '⚠️',
    color: 'text-yellow-400'
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: '❌',
    color: 'text-red-400'
  }
};

export const NotificationCenter = ({ className = '' }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initialize with some sample notifications
    const sampleNotifications: Notification[] = [
      {
        id: '1',
        type: 'success',
        title: 'Sistem Online',
        message: 'Semua sistem berjalan normal',
        timestamp: new Date().toISOString(),
        read: false
      },
      {
        id: '2',
        type: 'warning',
        title: 'TV #3 Tidak Responsif',
        message: 'TV #3 tidak merespons ping selama 5 menit',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        read: false,
        action: {
          label: 'Periksa TV',
          onClick: () => alert('Navigasi ke TV #3')
        }
      },
      {
        id: '3',
        type: 'info',
        title: 'Member Baru',
        message: '3 member baru terdaftar hari ini',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: true
      },
      {
        id: '4',
        type: 'error',
        title: 'Koneksi WhatsApp Terputus',
        message: 'Bot WhatsApp tidak dapat terhubung',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: false,
        action: {
          label: 'Reconnect',
          onClick: () => alert('Mencoba menghubungkan ulang...')
        }
      }
    ];

    setNotifications(sampleNotifications);
    setUnreadCount(sampleNotifications.filter(n => !n.read).length);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} jam lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari lalu`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded-lg"
      >
        <div className="text-xl">🔔</div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Notifikasi</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Tandai Semua Dibaca
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">🔕</div>
                  <p>Tidak ada notifikasi</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const styles = notificationStyles[notification.type];
                  
                  return (
                    <div
                      key={notification.id}
                      className={`
                        p-4 border-b border-gray-700/50 transition-all duration-200
                        ${notification.read ? 'opacity-60' : 'bg-gray-700/20'}
                        hover:bg-gray-700/30
                      `}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`
                          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                          ${styles.bg} ${styles.border} border
                        `}>
                          <span className="text-sm">{styles.icon}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-semibold ${notification.read ? 'text-gray-300' : 'text-white'}`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                          
                          <p className={`text-sm mt-1 ${notification.read ? 'text-gray-400' : 'text-gray-300'}`}>
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(notification.timestamp)}
                            </span>
                            
                            {notification.action && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notification.action!.onClick();
                                }}
                                className={`text-xs px-2 py-1 rounded ${styles.color} hover:bg-white/10 transition-colors`}
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
