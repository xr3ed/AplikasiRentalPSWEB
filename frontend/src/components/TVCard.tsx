'use client';

import { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';

// Define types for our data
type TV = {
  id: number;
  name: string;
  ip_address: string;
  status: 'on' | 'off' | 'inactive';
  isOnline?: boolean;
  session_end_time?: string;
  remaining_seconds?: number;
  current_member_id?: number;
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

// Helper function to format time
const formatTime = (totalSeconds: number) => {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const TVCard = ({
  tv,
  onStartSession,
  onStopSession,
  statusStability,
  isTransitioning = false
}: {
  tv: TV,
  onStartSession: (tvId: number) => void,
  onStopSession: (tvId: number) => void,
  statusStability?: { level: string, color: string },
  isTransitioning?: boolean
}) => {
  const [remainingTime, setRemainingTime] = useState(tv.remaining_seconds || 0);

  // Helper function to get monitoring status configuration with modern theme
  const getMonitoringStatusConfig = () => {
    const status = tv.monitoring_status || 'unknown';

    const statusConfig = {
      active: {
        color: 'green',
        icon: '🎮',
        label: 'SIAP DIGUNAKAN',
        description: 'Semua sistem normal',
        bgClass: 'bg-green-900/20 border-green-500/30 text-green-300',
        cardBorder: 'border-green-500/30',
        cardGlow: 'shadow-green-500/20',
        disabled: false,
        showRecovery: false
      },
      disconnected: {
        color: 'yellow',
        icon: '⚠️',
        label: 'APLIKASI TIDAK AKTIF',
        description: 'Helper app tidak berjalan',
        bgClass: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300',
        cardBorder: 'border-yellow-500/30',
        cardGlow: 'shadow-yellow-500/20',
        disabled: true,
        showRecovery: true
      },
      offline: {
        color: 'red',
        icon: '📡',
        label: 'PERANGKAT TIDAK TERJANGKAU',
        description: 'Cek koneksi jaringan/power TV',
        bgClass: 'bg-red-900/20 border-red-500/30 text-red-300',
        cardBorder: 'border-red-500/30',
        cardGlow: 'shadow-red-500/20',
        disabled: true,
        showRecovery: false
      },
      recovering: {
        color: 'purple',
        icon: '🔄',
        label: 'MEMULIHKAN SISTEM',
        description: 'Sedang melakukan recovery',
        bgClass: 'bg-purple-900/20 border-purple-500/30 text-purple-300',
        cardBorder: 'border-purple-500/30',
        cardGlow: 'shadow-purple-500/20',
        disabled: true,
        showRecovery: false
      },
      error: {
        color: 'orange',
        icon: '🚨',
        label: 'APLIKASI BERMASALAH',
        description: 'Helper app hang/crash',
        bgClass: 'bg-orange-900/20 border-orange-500/30 text-orange-300',
        cardBorder: 'border-orange-500/30',
        cardGlow: 'shadow-orange-500/20',
        disabled: true,
        showRecovery: true
      },
      unknown: {
        color: 'gray',
        icon: '❓',
        label: 'STATUS TIDAK DIKETAHUI',
        description: 'Sedang mengecek status',
        bgClass: 'bg-gray-900/20 border-gray-500/30 text-gray-300',
        cardBorder: 'border-gray-500/30',
        cardGlow: 'shadow-gray-500/20',
        disabled: true,
        showRecovery: false
      }
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
  };

  const monitoringConfig = getMonitoringStatusConfig();

  // Update remaining time every second
  useEffect(() => {
    if (tv.remaining_seconds && tv.remaining_seconds > 0) {
      const interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [tv.remaining_seconds]);

  // Sync with prop changes
  useEffect(() => {
    setRemainingTime(tv.remaining_seconds || 0);
  }, [tv.remaining_seconds]);

  const isSessionActive = tv.status === 'on' && remainingTime > 0;

  // Helper function to trigger recovery
  const triggerRecovery = () => {
    if ((window as any).triggerRecovery) {
      (window as any).triggerRecovery(tv.id);
    }
  };

  // Helper function to get button text
  const getButtonText = () => {
    if (!tv.isOnline) return 'Perangkat Offline';
    if (monitoringConfig.disabled) {
      switch (tv.monitoring_status) {
        case 'disconnected':
          return 'Aplikasi Tidak Aktif';
        case 'recovering':
          return 'Sedang Memulihkan...';
        case 'error':
          return 'Aplikasi Bermasalah';
        default:
          return 'Tidak Tersedia';
      }
    }
    return 'Mulai Sesi Gaming';
  };

  // Get modern card styling based on status with purple/blue theme
  const getCardStyling = () => {
    if (isSessionActive) {
      return {
        background: 'bg-gradient-to-br from-purple-900/30 to-blue-900/20',
        border: 'border-purple-500/40',
        glow: 'shadow-lg shadow-purple-500/25',
        accent: 'text-purple-300'
      };
    }

    const status = tv.monitoring_status || 'unknown';
    switch (status) {
      case 'active':
        return {
          background: 'bg-gradient-to-br from-purple-900/20 to-blue-900/10',
          border: 'border-green-500/30',
          glow: 'shadow-lg shadow-green-500/20',
          accent: 'text-green-300'
        };
      case 'disconnected':
        return {
          background: 'bg-gradient-to-br from-purple-900/20 to-blue-900/10',
          border: 'border-yellow-500/30',
          glow: 'shadow-lg shadow-yellow-500/20',
          accent: 'text-yellow-300'
        };
      case 'offline':
        return {
          background: 'bg-gradient-to-br from-purple-900/20 to-blue-900/10',
          border: 'border-red-500/30',
          glow: 'shadow-lg shadow-red-500/20',
          accent: 'text-red-300'
        };
      case 'recovering':
        return {
          background: 'bg-gradient-to-br from-purple-900/20 to-blue-900/10',
          border: 'border-purple-500/30',
          glow: 'shadow-lg shadow-purple-500/20',
          accent: 'text-purple-300'
        };
      case 'error':
        return {
          background: 'bg-gradient-to-br from-purple-900/20 to-blue-900/10',
          border: 'border-orange-500/30',
          glow: 'shadow-lg shadow-orange-500/20',
          accent: 'text-orange-300'
        };
      default:
        return {
          background: 'bg-gradient-to-br from-gray-900/20 to-gray-800/10',
          border: 'border-gray-500/30',
          glow: 'shadow-lg shadow-gray-500/20',
          accent: 'text-gray-300'
        };
    }
  };

  const cardStyling = getCardStyling();

  return (
    <div className={`
      relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-200 ease-in-out
      ${!isTransitioning ? 'hover:scale-105 hover-glow' : ''} will-change-transform flex flex-col overflow-hidden
      min-h-[200px] glass-card
      ${cardStyling.background} ${cardStyling.border} ${cardStyling.glow}
      ${isTransitioning ? 'pointer-events-none opacity-90' : ''}
    `}>
      {/* Modern Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12"></div>
      </div>

      {/* Status Banner - Modern top indicator */}
      {tv.monitoring_status && tv.monitoring_status !== 'unknown' && (
        <div className={`
          absolute top-0 left-0 right-0 backdrop-blur-sm z-10 rounded-t-xl border-b
          ${monitoringConfig.bgClass} ${monitoringConfig.cardBorder}
        `}>
          <div className="px-3 py-1.5 flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{monitoringConfig.icon}</span>
              <span className="font-medium text-xs">{monitoringConfig.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header Section - Compact and modern */}
      <div className={`relative text-center mb-3 ${
        tv.monitoring_status && tv.monitoring_status !== 'unknown' ? 'mt-8' : 'mt-4'
      }`}>
        <div className="text-2xl mb-2">🎮</div>
        <div>
          <h3 className="font-bold text-lg gradient-text mb-1">{tv.name}</h3>
          <p className="text-xs text-gray-400">{tv.ip_address}</p>
        </div>
      </div>

      {/* Content Section - Compact and modern */}
      <div className="relative flex-1 flex flex-col justify-center space-y-3">
        {isSessionActive ? (
          <>
            {/* Session Active - Timer Display */}
            <div className="text-center p-3 glass-effect rounded-lg border border-purple-500/30">
              <p className="text-xs text-gray-400 mb-1">Sisa Waktu</p>
              <p className="text-2xl font-bold gradient-text font-mono">{formatTime(remainingTime)}</p>
            </div>

            {/* Stop Session Button */}
            <button
              onClick={() => onStopSession(tv.id)}
              className="
                w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-red-700
                hover:from-red-500 hover:to-red-600 text-white font-semibold
                rounded-lg transition-all duration-300 transform hover:scale-105
                focus:outline-none focus:ring-2 focus:ring-red-500/50
                shadow-lg hover:shadow-xl text-sm
              "
            >
              🛑 Stop Sesi
            </button>
          </>
        ) : (
          <>
            {/* Status Display */}
            <div className="text-center p-3 glass-effect rounded-lg border border-gray-500/30">
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p className={`text-sm font-bold ${cardStyling.accent}`}>
                {monitoringConfig.label}
              </p>
              {monitoringConfig.description && (
                <p className="text-xs text-gray-500 mt-1">{monitoringConfig.description}</p>
              )}
            </div>

            {/* Recovery Button */}
            {monitoringConfig.showRecovery && (
              <button
                onClick={triggerRecovery}
                className="
                  w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600
                  hover:from-purple-500 hover:to-blue-500 text-white font-medium
                  rounded-lg transition-all duration-300 transform hover:scale-105
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50
                  shadow-lg hover:shadow-xl text-xs border border-purple-500/30
                  backdrop-blur-sm
                "
              >
                🔧 Pulihkan Aplikasi
              </button>
            )}

            {/* Main Action Button */}
            <button
              onClick={() => onStartSession(tv.id)}
              disabled={!tv.isOnline || monitoringConfig.disabled || isTransitioning}
              className="
                w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600
                hover:from-purple-500 hover:to-blue-500 text-white font-semibold
                rounded-lg transition-all duration-200 transform hover:scale-105
                disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
                disabled:transform-none disabled:hover:scale-100 disabled:opacity-50
                focus:outline-none focus:ring-2 focus:ring-purple-500/50
                shadow-lg hover:shadow-xl disabled:shadow-none text-sm
                border border-purple-500/30 backdrop-blur-sm will-change-transform
              "
            >
              {isTransitioning ? 'Memproses...' : getButtonText()}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TVCard;