'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Link from 'next/link';
import TVCard from '../components/TVCard';
import { DashboardLayout, DashboardGrid, DashboardGridItem } from '../components/DashboardGrid';
import MetricCardWithChart from '../components/MetricCardWithChart';
import ActivityFeed from '../components/ActivityFeed';
import SystemHealth from '../components/SystemHealth';
import StatusIndicator from '../components/StatusIndicator';
import '../styles/dashboard.css';

// Define types for our data
type TV = {
  id: number;
  name: string;
  ip_address: string;
  status: 'on' | 'off' | 'inactive';
  isOnline?: boolean;
  session_end_time?: string;
  remaining_seconds?: number;
  // Monitoring fields
  monitoring_status?: 'active' | 'disconnected' | 'offline' | 'recovering' | 'error' | 'unknown';
  last_ping_time?: string;
  last_heartbeat_time?: string;
  process_status?: string;
  auto_recovery_attempts?: number;
  last_recovery_time?: string;
  network_latency_ms?: number;
  socket_connection_id?: string;
  monitoring_enabled?: boolean;
};

type Package = {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
};

// Helper function to format date and time
const formatDateTime = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('id-ID', options).format(date).replace(/\./g, ':');
};

export default function Home() {
  const [tvs, setTvs] = useState<TV[]>([]);
  const [filteredTvs, setFilteredTvs] = useState<TV[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedTvId, setSelectedTvId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Toast notification states
  const [toastNotifications, setToastNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    timestamp: number;
  }>>([]);

  // Notification debouncing system
  const [notificationCooldowns, setNotificationCooldowns] = useState<Map<string, number>>(new Map());

  // Status history tracking for stability indicator
  const [statusHistory, setStatusHistory] = useState<Record<number, Array<{
    status: string;
    timestamp: number;
  }>>>({});

  // Anti-flickering states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Set<number>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<Record<number, number>>({});
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<number, Partial<TV>>>({});

  const [summary, setSummary] = useState({
    totalTvs: 0,
    activeTvs: 0,
    totalMembers: 0,
    totalPackages: 0,
    revenue: {
      today: 0,
      last7days: 0,
      last30days: 0,
    },
  });

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTvs(tvs);
    } else {
      const filtered = tvs.filter(tv =>
        tv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tv.ip_address.includes(searchQuery) ||
        tv.status.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTvs(filtered);
    }
  }, [tvs, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Helper function for toast notifications with debouncing
  const showToastNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning', tvId?: number) => {
    // Create a unique key for this notification type and TV
    const notificationKey = tvId ? `${type}-${tvId}-${message}` : `${type}-${message}`;
    const now = Date.now();

    // Check if this notification is in cooldown (prevent spam within 3 seconds)
    const lastNotificationTime = notificationCooldowns.get(notificationKey);
    if (lastNotificationTime && (now - lastNotificationTime) < 3000) {
      console.log(`🔇 Notification blocked (cooldown): ${message}`);
      return;
    }

    // Update cooldown
    setNotificationCooldowns(prev => new Map(prev.set(notificationKey, now)));

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = {
      id,
      message,
      type,
      timestamp: now
    };

    setToastNotifications(prev => [...prev, newToast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(toast => toast.id !== id));
    }, 5000);

    // Clean up old cooldowns (older than 10 seconds)
    setTimeout(() => {
      setNotificationCooldowns(prev => {
        const newMap = new Map(prev);
        for (const [key, timestamp] of newMap.entries()) {
          if (now - timestamp > 10000) {
            newMap.delete(key);
          }
        }
        return newMap;
      });
    }, 10000);
  };

  // Anti-flickering helper functions (Fixed for real-time updates)
  const shouldUpdateTV = (tvId: number, newData: Partial<TV>, isRealTimeUpdate = false) => {
    const now = Date.now();
    const lastUpdate = lastUpdateTime[tvId] || 0;
    const timeDiff = now - lastUpdate;

    // For real-time updates (socket events), allow more frequent updates
    const minInterval = isRealTimeUpdate ? 100 : 300; // Reduced from 500ms

    // Prevent rapid updates only for non-real-time updates
    if (!isRealTimeUpdate && timeDiff < minInterval) {
      return false;
    }

    // Check if this is a meaningful change
    const currentTv = tvs.find(tv => tv.id === tvId);
    if (!currentTv) return true;

    // For monitoring status changes, always allow updates
    if (newData.monitoring_status && newData.monitoring_status !== currentTv.monitoring_status) {
      return true;
    }

    // For session status changes, always allow updates
    if (newData.status && newData.status !== currentTv.status) {
      return true;
    }

    // For other changes, check if there's any meaningful difference
    const hasChanges = Object.keys(newData).some(key => {
      return newData[key as keyof TV] !== currentTv[key as keyof TV];
    });

    return hasChanges;
  };

  const updateTVWithDebounce = (tvId: number, updates: Partial<TV>, isRealTimeUpdate = false) => {
    if (!shouldUpdateTV(tvId, updates, isRealTimeUpdate)) {
      return;
    }

    setLastUpdateTime(prev => ({ ...prev, [tvId]: Date.now() }));

    setTvs(prevTvs => prevTvs.map(tv => {
      if (tv.id === tvId) {
        return { ...tv, ...updates };
      }
      return tv;
    }));
  };

  // Helper function to get monitoring status badge
  const getMonitoringStatusBadge = (tv: TV) => {
    const status = tv.monitoring_status || 'unknown';

    const statusConfig = {
      active: { color: 'green', icon: '🟢', label: 'ACTIVE', bgClass: 'bg-green-900/20 border-green-500/30 text-green-300' },
      disconnected: { color: 'yellow', icon: '🟡', label: 'DISCONNECTED', bgClass: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300' },
      offline: { color: 'red', icon: '🔴', label: 'OFFLINE', bgClass: 'bg-red-900/20 border-red-500/30 text-red-300' },
      recovering: { color: 'blue', icon: '🔄', label: 'RECOVERING', bgClass: 'bg-blue-900/20 border-blue-500/30 text-blue-300' },
      error: { color: 'orange', icon: '⚠️', label: 'ERROR', bgClass: 'bg-orange-900/20 border-orange-500/30 text-orange-300' },
      unknown: { color: 'gray', icon: '❓', label: 'UNKNOWN', bgClass: 'bg-gray-900/20 border-gray-500/30 text-gray-300' }
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
  };

  // Helper function to get status stability indicator
  const getStatusStability = (tvId: number) => {
    const history = statusHistory[tvId] || [];
    if (history.length < 2) return { level: 'stable', color: 'green' };

    const recentChanges = history.slice(-5); // Last 5 status changes
    const changeCount = recentChanges.length;
    const timeSpan = recentChanges[recentChanges.length - 1]?.timestamp - recentChanges[0]?.timestamp;
    const hourInMs = 60 * 60 * 1000;

    if (changeCount >= 4 && timeSpan < hourInMs) {
      return { level: 'unstable', color: 'red' };
    } else if (changeCount >= 2 && timeSpan < hourInMs) {
      return { level: 'moderate', color: 'yellow' };
    }

    return { level: 'stable', color: 'green' };
  };

  useEffect(() => {
    setIsClient(true);

    const fetchTVsAndInitialPing = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/tvs');
        const responseData = await response.json();
        if (Array.isArray(responseData.data)) {
          const tvsWithStatus = await Promise.all(responseData.data.map(async (tv: TV) => {
            try {
              const pingResponse = await fetch(`http://localhost:3001/api/tvs/${tv.id}/ping`);
              const pingData = await pingResponse.json();
              return { ...tv, isOnline: pingData.isOnline };
            } catch (pingError) {
              return { ...tv, isOnline: false };
            }
          }));
          setTvs(tvsWithStatus);
        } else {
          setTvs([]);
        }
      } catch (error) {
        console.error('Failed to fetch TVs:', error);
      }
    };

    const fetchSummaryData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/summary');
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error('Failed to fetch summary data:', error);
      }
    };

    const fetchPackages = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/packages');
        const data = await response.json();
        setPackages(data.data || []);
      } catch (error) {
        console.error('Failed to fetch packages:', error);
      }
    };

    fetchTVsAndInitialPing();
    fetchSummaryData();
    fetchPackages();

    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socket.on('tv_updated', (updatedTv) => {
      // Use functional updates to avoid stale closure
      setOptimisticUpdates(prevOptimistic => {
        const hasOptimisticUpdate = prevOptimistic[updatedTv.id];

        if (hasOptimisticUpdate) {
          // Merge server data with optimistic update, server data takes precedence
          const mergedUpdate = { ...hasOptimisticUpdate, ...updatedTv };

          // Apply merged update immediately
          setTvs(prevTvs => prevTvs.map(tv =>
            tv.id === updatedTv.id ? { ...tv, ...mergedUpdate } : tv
          ));

          // Clear optimistic update
          const newOptimistic = { ...prevOptimistic };
          delete newOptimistic[updatedTv.id];
          return newOptimistic;
        } else {
          // Normal server update - apply immediately
          setTvs(prevTvs => prevTvs.map(tv =>
            tv.id === updatedTv.id ? { ...tv, ...updatedTv } : tv
          ));
          return prevOptimistic;
        }
      });

      // Fetch summary data for real-time updates
      setTimeout(() => {
        fetchSummaryData();
      }, 200);
    });

    socket.on('summary_updated', (newSummary) => {
      // Always update summary for real-time data, but with a small delay during transitions
      if (isTransitioning) {
        setTimeout(() => {
          setSummary(newSummary);
        }, 300);
      } else {
        setSummary(newSummary);
      }
    });

    // Listen for TV monitoring status updates
    socket.on('tv-status-update', (data) => {
      const { tvId, status, networkStatus, processStatus, heartbeatStatus, latency, timestamp } = data;

      // Use functional updates to avoid stale closure issues
      setTvs(prevTvs => {
        const currentTv = prevTvs.find(tv => tv.id === tvId);
        if (!currentTv) {
          return prevTvs;
        }

        const previousStatus = currentTv.monitoring_status;

        // Skip duplicate status updates
        if (previousStatus === status) {
          return prevTvs;
        }

        const updatedTvs = prevTvs.map(tv => {
          if (tv.id === tvId) {
            return {
              ...tv,
              monitoring_status: status,
              network_latency_ms: latency,
              last_ping_time: networkStatus ? timestamp : tv.last_ping_time,
              last_heartbeat_time: heartbeatStatus ? timestamp : tv.last_heartbeat_time,
              process_status: processStatus
            };
          }
          return tv;
        });

        // Auto QR refresh when status changes from disconnected to active (no toast - handled by immediate connect)
        if (previousStatus === 'disconnected' && status === 'active') {
          socket.emit('refresh-qr-code', { tvId });
        }

        // Track status history for stability indicator
        if (previousStatus !== status) {
          setStatusHistory(prevHistory => {
            const tvHistory = prevHistory[tvId] || [];
            const newHistory = [...tvHistory, { status, timestamp: Date.now() }];
            const trimmedHistory = newHistory.slice(-10);

            return {
              ...prevHistory,
              [tvId]: trimmedHistory
            };
          });
        }

        return updatedTvs;
      });
    });

    // Listen for recovery events with toast notifications (with debouncing)
    socket.on('tv-recovery-event', (data) => {
      const { tvId, eventType } = data;

      if (eventType === 'recovery-started') {
        setTvs(prevTvs => prevTvs.map(tv => {
          if (tv.id === tvId) {
            return { ...tv, monitoring_status: 'recovering' };
          }
          return tv;
        }));

        // Show toast notification for recovery started (with debouncing)
        showToastNotification(`🔧 Recovery started for TV ${tvId}`, 'info', tvId);
      } else if (eventType === 'recovery-success') {
        showToastNotification(`✅ Recovery successful for TV ${tvId}`, 'success', tvId);
      } else if (eventType === 'recovery-failed') {
        showToastNotification(`❌ Recovery failed for TV ${tvId}`, 'error', tvId);
      }
    });

    // Listen for immediate connect events (with debouncing)
    socket.on('tv-immediate-connect', (data) => {
      const { tvId, timestamp } = data;

      // Update TV status immediately to active
      setTvs(prevTvs => prevTvs.map(tv => {
        if (tv.id === tvId) {
          return {
            ...tv,
            monitoring_status: 'active',
            last_heartbeat_time: timestamp,
            process_status: 'running',
            isOnline: true
          };
        }
        return tv;
      }));

      // Show success notification (with debouncing)
      showToastNotification(`🚀 TV ${tvId} helper app connected instantly!`, 'success', tvId);
    });

    // Listen for auto-update events
    socket.on('tv-update-event', (data) => {
      const { tvId, eventType, message, newVersion, error } = data;

      if (eventType === 'update-started') {
        showToastNotification(`🔄 Starting auto-update for TV ${tvId}...`, 'info');

        // Update TV status to show updating
        setTvs(prevTvs => prevTvs.map(tv => {
          if (tv.id === tvId) {
            return { ...tv, monitoring_status: 'updating' };
          }
          return tv;
        }));
      } else if (eventType === 'update-progress') {
        showToastNotification(`🔄 TV ${tvId}: ${message}`, 'info');
      } else if (eventType === 'update-completed') {
        showToastNotification(`✅ TV ${tvId} updated to version ${newVersion}!`, 'success');

        // Update TV status back to active with new version
        setTvs(prevTvs => prevTvs.map(tv => {
          if (tv.id === tvId) {
            return {
              ...tv,
              monitoring_status: 'active',
              app_version: newVersion
            };
          }
          return tv;
        }));
      } else if (eventType === 'update-failed') {
        showToastNotification(`❌ TV ${tvId} update failed: ${error}`, 'error');

        // Revert TV status
        setTvs(prevTvs => prevTvs.map(tv => {
          if (tv.id === tvId) {
            return { ...tv, monitoring_status: 'active' };
          }
          return tv;
        }));
      }
    });

    const dateTimeTimer = setInterval(() => setDateTime(new Date()), 1000);

    const updateTvsOnlineStatus = async () => {
      // Use functional update to get current state
      setTvs(currentTvs => {
        if (currentTvs.length === 0) return currentTvs;

        // Process TVs asynchronously
        currentTvs.forEach(async (tv) => {
          try {
            const pingResponse = await fetch(`http://localhost:3001/api/tvs/${tv.id}/ping`);
            const pingData = await pingResponse.json();
            const isNowOnline = pingData.isOnline;

            // Only update if status actually changed
            if (tv.isOnline !== isNowOnline) {
              // Use functional update to avoid stale closure
              setTvs(prevTvs => prevTvs.map(prevTv =>
                prevTv.id === tv.id ? { ...prevTv, isOnline: isNowOnline } : prevTv
              ));
            }
          } catch (pingError) {
            // Only update to offline if currently online
            if (tv.isOnline) {
              setTvs(prevTvs => prevTvs.map(prevTv =>
                prevTv.id === tv.id ? { ...prevTv, isOnline: false } : prevTv
              ));
            }
          }
        });

        return currentTvs; // Return current state unchanged
      });
    };

    // Increase ping interval to reduce conflicts with socket updates
    const tvPingInterval = setInterval(updateTvsOnlineStatus, 10000); // Back to 10 seconds

    // Define triggerRecovery function within useEffect to access socket
    window.triggerRecovery = (tvId: number) => {
      socket.emit('trigger-tv-recovery', { tvId });
      showToastNotification(`🔧 Manual recovery triggered for TV ${tvId}`, 'info');
    };

    return () => {
      clearInterval(dateTimeTimer);
      clearInterval(tvPingInterval);
      socket.disconnect();
      // Clean up global function
      delete (window as any).triggerRecovery;
    };
  }, []); // Keep empty dependency array to run only once on mount

  const handleStartSession = (tvId: number) => {
    setSelectedTvId(tvId);
    setShowPackageModal(true);
  };

  const handlePackageSelect = async (packageId: number) => {
    if (!selectedTvId) return;

    // Prevent multiple rapid clicks
    if (isTransitioning || pendingUpdates.has(selectedTvId)) {
      return;
    }

    setLoading(true);
    setIsTransitioning(true);
    setPendingUpdates(prev => new Set([...prev, selectedTvId]));

    try {
      // Store optimistic update
      const selectedPackage = packages.find(pkg => pkg.id === packageId);
      const optimisticUpdate = {
        status: 'on' as const,
        package_id: packageId,
        remaining_seconds: selectedPackage ? selectedPackage.duration_minutes * 60 : 0,
        session_end_time: selectedPackage
          ? new Date(Date.now() + selectedPackage.duration_minutes * 60 * 1000).toISOString()
          : undefined
      };

      setOptimisticUpdates(prev => ({ ...prev, [selectedTvId]: optimisticUpdate }));

      const response = await fetch(`http://localhost:3001/api/tvs/${selectedTvId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'on',
          package_id: packageId,
          member_id: null
        }),
      });

      if (response.ok) {
        // Apply optimistic update with smooth transition
        updateTVWithDebounce(selectedTvId, optimisticUpdate);

        // Close modal with delay for smooth animation
        setTimeout(() => {
          setShowPackageModal(false);
          setSelectedTvId(null);
        }, 300);

        showToastNotification(`🎮 Sesi gaming dimulai untuk TV ${selectedTvId}`, 'success');
      } else {
        // Revert optimistic update on error
        setOptimisticUpdates(prev => {
          const newUpdates = { ...prev };
          delete newUpdates[selectedTvId];
          return newUpdates;
        });

        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('Failed to parse error response as JSON:', errorText);
          showToastNotification('Server returned an unexpected response', 'error');
          return;
        }
        console.error('Failed to start session:', errorData.error || errorText);
        showToastNotification(`Error: ${errorData.error || 'Failed to start session'}`, 'error');
      }
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[selectedTvId];
        return newUpdates;
      });

      console.error('Error starting session:', error);
      showToastNotification('Network error occurred', 'error');
    } finally {
      setLoading(false);
      setIsTransitioning(false);
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedTvId);
        return newSet;
      });
    }
  };

  const closeModal = () => {
    // Add smooth closing animation
    setIsTransitioning(true);

    // Add closing animation class
    const modal = document.querySelector('.modal-content');
    if (modal) {
      modal.classList.add('animate-modal-scale-out');
    }

    setTimeout(() => {
      setShowPackageModal(false);
      setSelectedTvId(null);
      setIsTransitioning(false);
    }, 200);
  };

  const handleStopSession = async (tvId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/tvs/${tvId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'off' }),
      });

      if (response.ok) {
        // The backend will emit 'tv_updated', so we might not need this optimistic update,
        // but it can make the UI feel more responsive.
        setTvs(prevTvs => 
          prevTvs.map(tv => 
            tv.id === tvId ? { ...tv, status: 'off', remaining_seconds: 0 } : tv
          )
        );
      } else {
        const errorData = await response.json();
        console.error('Failed to stop session:', errorData.message);
        // Optionally, show an error message to the user
      }
    } catch (error) {
      console.error('Error stopping session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-x-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Enhanced Header */}
      <header className="relative z-10 glass-card border-b border-gray-700/50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 space-y-4 lg:space-y-0">
          {/* Logo and Title Section */}
          <div className="flex items-center animate-fade-in">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl mr-4 shadow-lg shadow-purple-500/25">
              <div className="text-2xl">🎮</div>
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text mb-1">
                PS Rental Dashboard
              </h1>
              {isClient ? (
                <p className="text-sm text-gray-400 font-medium">{formatDateTime(dateTime)}</p>
              ) : (
                <div className="h-5 bg-gray-700 rounded animate-pulse w-48"></div>
              )}
            </div>
          </div>

          {/* Search and Actions Section */}
          <div className="flex items-center space-x-4 animate-slide-in-right w-full lg:w-auto">
            {/* Quick Search */}
            <div className="flex-1 lg:flex-none lg:w-64">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari TV atau sesi..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="
                    w-full px-4 py-3 pl-10 pr-4 text-sm
                    glass-effect rounded-xl border border-gray-600/50
                    focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20
                    text-white placeholder-gray-400
                    transition-all duration-300
                  "
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </div>
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <Link
                href="/management"
                className="
                  bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500
                  text-white font-semibold py-3 px-6 rounded-xl flex items-center text-sm
                  transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50
                "
              >
                <span className="mr-2">⚙️</span>
                <span className="hidden sm:inline">Management</span>
              </Link>

              <button className="
                glass-effect hover:bg-gray-700/50 text-white font-semibold py-3 px-6 rounded-xl
                flex items-center text-sm border border-gray-600/50 hover:border-gray-500/50
                transition-all duration-300 transform hover:scale-105 hover:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-gray-500/50
              ">
                <span className="mr-2">📱</span>
                <span className="hidden sm:inline">QR Scanner</span>
              </button>
            </div>
          </div>
        </div>

        {/* System Status Bar */}
        <div className="px-4 md:px-6 pb-4">
          <div className="flex items-center justify-center sm:justify-start text-xs">
            <div className="flex items-center space-x-3 md:space-x-6 overflow-x-auto">
              <StatusIndicator
                status="online"
                label="System"
                description="Operational"
              />
              <StatusIndicator
                status={summary.activeTvs > 0 ? "online" : "offline"}
                label={`${summary.activeTvs}/${summary.totalTvs} TV Aktif`}
                description="PlayStation units"
              />
              <StatusIndicator
                status="online"
                label="WebSocket"
                description="Real-time connected"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Dashboard Layout */}
      <div className="relative z-10 p-4 md:p-6">
        <DashboardLayout
          rightPanel={
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="glass-card rounded-xl p-6 border border-gray-700/50 hover-glow">
                <h3 className="text-lg font-bold text-white mb-4 gradient-text">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    href="/management/tvs"
                    className="flex items-center p-3 rounded-lg bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-105"
                  >
                    <div className="text-2xl mr-3">📺</div>
                    <div>
                      <p className="font-semibold text-white">Manage TVs</p>
                      <p className="text-xs opacity-75">Configure PlayStation units</p>
                    </div>
                  </Link>
                  <Link
                    href="/management/members"
                    className="flex items-center p-3 rounded-lg bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105"
                  >
                    <div className="text-2xl mr-3">👥</div>
                    <div>
                      <p className="font-semibold text-white">Manage Members</p>
                      <p className="text-xs opacity-75">User management</p>
                    </div>
                  </Link>
                  <Link
                    href="/management/transactions"
                    className="flex items-center p-3 rounded-lg bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 hover:border-green-400/50 transition-all duration-300 hover:scale-105"
                  >
                    <div className="text-2xl mr-3">💰</div>
                    <div>
                      <p className="font-semibold text-white">View Transactions</p>
                      <p className="text-xs opacity-75">Revenue reports</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="glass-card rounded-xl p-6 border border-gray-700/50 hover-glow">
                <h3 className="text-lg font-bold text-white mb-4 gradient-text">Recent Activity</h3>
                <ActivityFeed maxItems={5} />
              </div>

              {/* System Health */}
              <div className="glass-card rounded-xl p-6 border border-gray-700/50 hover-glow">
                <h3 className="text-lg font-bold text-white mb-4 gradient-text">System Health</h3>
                <SystemHealth />
              </div>
            </div>
          }
        >
          {/* Mini Summary Cards */}
          <div className="p-3 md:p-4 rounded-xl bg-gray-900/20 border border-gray-700/10 backdrop-blur-sm mb-4 md:mb-6">
            <DashboardGrid className="mb-0">
            <DashboardGridItem>
              <MetricCardWithChart
                title="Total TV"
                value={summary.totalTvs}
                subtitle={`${summary.activeTvs} aktif`}
                icon="📺"
                color="purple"
                trend={{ value: 5.2, isPositive: true }}
                chartData={[
                  { label: 'Mon', value: summary.totalTvs - 2 },
                  { label: 'Tue', value: summary.totalTvs - 1 },
                  { label: 'Wed', value: summary.totalTvs - 1 },
                  { label: 'Thu', value: summary.totalTvs },
                  { label: 'Fri', value: summary.totalTvs },
                  { label: 'Sat', value: summary.totalTvs + 1 },
                  { label: 'Sun', value: summary.totalTvs }
                ]}
                chartType="area"
                onClick={() => window.location.href = '/management/tvs'}
                className="animate-fade-in"
                size="mini"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Sesi Aktif"
                value={summary.activeTvs}
                subtitle="Sedang bermain"
                icon="🎮"
                color="blue"
                trend={{ value: 12.5, isPositive: true }}
                chartData={[
                  { label: 'Mon', value: Math.max(0, summary.activeTvs - 2) },
                  { label: 'Tue', value: Math.max(0, summary.activeTvs - 1) },
                  { label: 'Wed', value: summary.activeTvs },
                  { label: 'Thu', value: summary.activeTvs + 1 },
                  { label: 'Fri', value: summary.activeTvs },
                  { label: 'Sat', value: summary.activeTvs + 2 },
                  { label: 'Sun', value: summary.activeTvs }
                ]}
                chartType="line"
                onClick={() => window.location.href = '/management/sessions'}
                className="animate-fade-in"
                size="mini"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Total Member"
                value={summary.totalMembers}
                subtitle="Member terdaftar"
                icon="👥"
                color="indigo"
                trend={{ value: 8.3, isPositive: true }}
                chartData={[
                  { label: 'Mon', value: Math.max(0, summary.totalMembers - 5) },
                  { label: 'Tue', value: Math.max(0, summary.totalMembers - 3) },
                  { label: 'Wed', value: Math.max(0, summary.totalMembers - 2) },
                  { label: 'Thu', value: summary.totalMembers - 1 },
                  { label: 'Fri', value: summary.totalMembers },
                  { label: 'Sat', value: summary.totalMembers + 1 },
                  { label: 'Sun', value: summary.totalMembers + 2 }
                ]}
                chartType="bar"
                onClick={() => window.location.href = '/management/members'}
                className="animate-fade-in"
                size="mini"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Pendapatan Hari Ini"
                value={`Rp ${summary.revenue.today.toLocaleString('id-ID')}`}
                subtitle="Revenue today"
                icon="💰"
                color="green"
                trend={{ value: 15.7, isPositive: true }}
                chartData={[
                  { label: 'Mon', value: Math.max(0, summary.revenue.today - 200000) },
                  { label: 'Tue', value: Math.max(0, summary.revenue.today - 150000) },
                  { label: 'Wed', value: Math.max(0, summary.revenue.today - 100000) },
                  { label: 'Thu', value: Math.max(0, summary.revenue.today - 50000) },
                  { label: 'Fri', value: summary.revenue.today },
                  { label: 'Sat', value: summary.revenue.today + 50000 },
                  { label: 'Sun', value: summary.revenue.today + 100000 }
                ]}
                chartType="area"
                onClick={() => window.location.href = '/management/transactions'}
                className="animate-fade-in"
                size="mini"
              />
            </DashboardGridItem>
            </DashboardGrid>
          </div>

          {/* Section Separator */}
          <div className="relative my-6 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/30"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 md:px-4 bg-gray-900 text-gray-400">PlayStation Units</span>
            </div>
          </div>

          {/* Enhanced TV Status Grid */}
          <div className="mb-6 md:mb-8 p-4 md:p-6 rounded-xl bg-gray-900/30 border border-gray-700/20 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold gradient-text">PlayStation Units</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>Online ({filteredTvs.filter(tv => tv.isOnline).length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span>Offline ({filteredTvs.filter(tv => !tv.isOnline).length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span>Active ({filteredTvs.filter(tv => tv.status === 'on').length})</span>
                </div>
                {searchQuery && (
                  <div className="flex items-center space-x-2 text-purple-400">
                    <span>🔍</span>
                    <span>Found: {filteredTvs.length} / {tvs.length}</span>
                  </div>
                )}
              </div>
            </div>

            <DashboardGrid>
              {filteredTvs.length === 0 && tvs.length === 0 ? (
                // Enhanced Loading skeleton
                Array.from({ length: 8 }).map((_, index) => (
                  <DashboardGridItem key={index}>
                    <div className="animate-pulse">
                      <div className="glass-card rounded-xl p-6 border border-gray-700/50 h-48">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-700 rounded-xl"></div>
                            <div>
                              <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
                              <div className="h-3 bg-gray-700 rounded w-24"></div>
                            </div>
                          </div>
                          <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="h-3 bg-gray-700 rounded w-full"></div>
                          <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                          <div className="h-10 bg-gray-700 rounded-lg mt-4"></div>
                        </div>
                      </div>
                    </div>
                  </DashboardGridItem>
                ))
              ) : filteredTvs.length === 0 && searchQuery ? (
                // No search results
                <DashboardGridItem span={4}>
                  <div className="glass-card rounded-xl p-12 border border-gray-700/50 text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-white mb-2">Tidak ada hasil</h3>
                    <p className="text-gray-400 mb-4">
                      Tidak ditemukan TV dengan kata kunci "{searchQuery}"
                    </p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-2 rounded-lg transition-all duration-300 hover:scale-105"
                    >
                      Clear Search
                    </button>
                  </div>
                </DashboardGridItem>
              ) : (
                filteredTvs.map((tv, index) => {
                  // Apply optimistic updates if available
                  const tvWithOptimisticUpdates = optimisticUpdates[tv.id]
                    ? { ...tv, ...optimisticUpdates[tv.id] }
                    : tv;

                  return (
                    <DashboardGridItem
                      key={tv.id}
                      className="animate-smooth-fade-in tv-card-transition will-change-transform"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationDuration: '400ms'
                      }}
                    >
                      <TVCard
                        tv={tvWithOptimisticUpdates}
                        onStartSession={handleStartSession}
                        onStopSession={handleStopSession}
                        statusStability={getStatusStability(tv.id)}
                        isTransitioning={isTransitioning || pendingUpdates.has(tv.id)}
                      />
                    </DashboardGridItem>
                  );
                })
              )}
            </DashboardGrid>
          </div>
        </DashboardLayout>

        {/* Enhanced Package Selection Modal with Anti-Flickering */}
        {showPackageModal && (
          <>
            {/* Enhanced Backdrop with smooth animation */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 animate-modal-fade-in"
              onClick={closeModal}
              style={{ animationDuration: '200ms' }}
            ></div>

            {/* Enhanced Modal with smooth transitions */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="
                modal-content glass-card border border-gray-600/50 rounded-2xl shadow-2xl
                max-w-lg w-full animate-modal-scale-in transform
                will-change-transform
              " style={{ animationDuration: '300ms' }}>
                {/* Enhanced Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-600/30">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                      <div className="text-2xl">📦</div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold gradient-text">Pilih Paket Gaming</h2>
                      <p className="text-sm text-gray-400">Pilih durasi sesi PlayStation</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    disabled={isTransitioning}
                    className="
                      text-gray-400 hover:text-white p-2 rounded-xl
                      hover:bg-gray-700/50 transition-all duration-200 hover:scale-110
                      focus:outline-none focus:ring-2 focus:ring-purple-500/50
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                    "
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Enhanced Package List */}
                <div className="p-6 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                  {packages.map((pkg, index) => (
                    <button
                      key={pkg.id}
                      onClick={() => handlePackageSelect(pkg.id)}
                      disabled={loading || isTransitioning || pendingUpdates.has(selectedTvId || 0)}
                      className="
                        w-full p-5 glass-effect rounded-xl text-left
                        border border-gray-600/30 hover:border-purple-500/50
                        transition-all duration-200 transform hover:scale-102 hover:shadow-lg hover:shadow-purple-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        focus:outline-none focus:ring-2 focus:ring-purple-500/50
                        animate-fade-in interactive-card will-change-transform
                      "
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationDuration: '400ms'
                      } as React.CSSProperties}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 p-3 rounded-xl border border-indigo-500/30">
                            <div className="text-2xl">⏱️</div>
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">{pkg.name}</h3>
                            <p className="text-sm text-gray-400">{pkg.duration_minutes} menit gaming</p>
                            <div className="flex items-center mt-1 text-xs text-gray-500">
                              <span>🎮</span>
                              <span className="ml-1">PlayStation Session</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-400 text-xl">Rp {pkg.price.toLocaleString('id-ID')}</p>
                          <p className="text-xs text-gray-500">per sesi</p>
                          <div className="mt-1 text-xs text-purple-400">
                            ~Rp {Math.round(pkg.price / pkg.duration_minutes).toLocaleString('id-ID')}/menit
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Enhanced Empty State */}
                {packages.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="bg-gradient-to-br from-gray-700/20 to-gray-800/20 rounded-2xl p-8 border border-gray-600/30">
                      <div className="text-6xl mb-4">📦</div>
                      <p className="text-gray-300 mb-2 text-lg font-semibold">Tidak ada paket tersedia</p>
                      <p className="text-sm text-gray-500">Silakan hubungi administrator untuk menambahkan paket gaming</p>
                    </div>
                  </div>
                )}

                {/* Enhanced Loading State */}
                {loading && (
                  <div className="p-6 border-t border-gray-600/30">
                    <div className="flex items-center justify-center space-x-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                        <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border border-purple-400 opacity-20"></div>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Memulai sesi gaming...</p>
                        <p className="text-xs text-gray-400">Mohon tunggu sebentar</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Enhanced Footer */}
        <footer className="relative z-10 mt-12 border-t border-gray-700/50">
          <div className="glass-effect">
            <div className="p-6">
              <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
                {/* Branding Section */}
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg shadow-lg shadow-purple-500/25">
                    <div className="text-lg">🎮</div>
                  </div>
                  <div>
                    <p className="font-bold gradient-text">PS Rental Dashboard</p>
                    <p className="text-xs text-gray-400">Sistem Manajemen Rental PlayStation</p>
                  </div>
                </div>

                {/* System Info */}
                <div className="flex items-center space-x-8 text-sm text-gray-400">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Version</p>
                    <p className="font-semibold text-white">v2.1.0</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Uptime</p>
                    <p className="font-semibold text-green-400">24h 15m</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Status</p>
                    <div className="flex items-center justify-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <p className="font-semibold text-green-400">Online</p>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex items-center space-x-4">
                  <Link
                    href="/management"
                    className="text-gray-400 hover:text-purple-400 transition-colors duration-300 text-sm"
                  >
                    Management
                  </Link>
                  <span className="text-gray-600">•</span>
                  <button className="text-gray-400 hover:text-blue-400 transition-colors duration-300 text-sm">
                    Support
                  </button>
                  <span className="text-gray-600">•</span>
                  <button className="text-gray-400 hover:text-indigo-400 transition-colors duration-300 text-sm">
                    Settings
                  </button>
                </div>
              </div>

              {/* Copyright */}
              <div className="mt-4 pt-4 border-t border-gray-700/30 text-center">
                <p className="text-xs text-gray-500">
                  © 2024 PS Rental System. Built with modern web technologies.
                </p>
              </div>
            </div>
          </div>
        </footer>

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toastNotifications.map((toast, index) => (
            <div
              key={toast.id}
              className={`
                animate-slide-in-right max-w-sm w-full backdrop-blur-sm border rounded-xl shadow-lg
                transition-all duration-300 ease-in-out transform hover:scale-105
                ${toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-300' :
                  toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-300' :
                  toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50 text-yellow-300' :
                  'bg-blue-900/90 border-blue-500/50 text-blue-300'}
              `}
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="p-4 flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${toast.type === 'success' ? 'bg-green-500' :
                      toast.type === 'error' ? 'bg-red-500' :
                      toast.type === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'}
                  `}>
                    <span className="text-white text-sm">
                      {toast.type === 'success' ? '✓' :
                       toast.type === 'error' ? '✗' :
                       toast.type === 'warning' ? '⚠' : 'ℹ'}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{toast.message}</p>
                </div>
                <button
                  onClick={() => setToastNotifications(prev => prev.filter(t => t.id !== toast.id))}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
