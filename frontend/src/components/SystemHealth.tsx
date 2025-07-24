'use client';

import { useEffect, useState } from 'react';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  icon: string;
  description: string;
}

interface SystemHealthProps {
  className?: string;
}

const statusColors = {
  good: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400'
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    dot: 'bg-yellow-400'
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400'
  }
};

export const SystemHealth = ({ className = '' }: SystemHealthProps) => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [overallStatus, setOverallStatus] = useState<'good' | 'warning' | 'critical'>('good');
  const [uptime, setUptime] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client-side flag to prevent hydration mismatch
    setIsClient(true);

    fetchSystemMetrics();

    // Update metrics every 30 seconds
    const interval = setInterval(fetchSystemMetrics, 30000);

    // Update uptime every second
    const uptimeInterval = setInterval(updateUptime, 1000);

    // Update last updated time
    const timeInterval = setInterval(updateLastUpdated, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(uptimeInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const fetchSystemMetrics = async () => {
    try {
      // Only generate random data on client side to prevent hydration mismatch
      if (!isClient) {
        // Set initial static data for server-side rendering
        const staticMetrics: SystemMetric[] = [
          {
            name: 'CPU Usage',
            value: 45.2,
            unit: '%',
            status: 'good',
            icon: '🖥️',
            description: 'Penggunaan CPU server'
          },
          {
            name: 'Memory Usage',
            value: 62.8,
            unit: '%',
            status: 'good',
            icon: '💾',
            description: 'Penggunaan memori RAM'
          },
          {
            name: 'Database Size',
            value: 234.5,
            unit: 'MB',
            status: 'good',
            icon: '🗄️',
            description: 'Ukuran database SQLite'
          },
          {
            name: 'Active Connections',
            value: 12,
            unit: '',
            status: 'good',
            icon: '🔗',
            description: 'Koneksi aktif ke server'
          },
          {
            name: 'Response Time',
            value: 125,
            unit: 'ms',
            status: 'good',
            icon: '⚡',
            description: 'Waktu respons rata-rata API'
          },
          {
            name: 'Error Rate',
            value: 0.8,
            unit: '%',
            status: 'good',
            icon: '❌',
            description: 'Tingkat error dalam 1 jam terakhir'
          }
        ];
        setMetrics(staticMetrics);
        return;
      }

      // Generate dynamic data only on client side
      const mockMetrics: SystemMetric[] = [
        {
          name: 'CPU Usage',
          value: Math.random() * 100,
          unit: '%',
          status: 'good',
          icon: '🖥️',
          description: 'Penggunaan CPU server'
        },
        {
          name: 'Memory Usage',
          value: Math.random() * 100,
          unit: '%',
          status: 'good',
          icon: '💾',
          description: 'Penggunaan memori RAM'
        },
        {
          name: 'Database Size',
          value: Math.random() * 1000,
          unit: 'MB',
          status: 'good',
          icon: '🗄️',
          description: 'Ukuran database SQLite'
        },
        {
          name: 'Active Connections',
          value: Math.floor(Math.random() * 50),
          unit: '',
          status: 'good',
          icon: '🔗',
          description: 'Koneksi aktif ke server'
        },
        {
          name: 'Response Time',
          value: Math.random() * 500,
          unit: 'ms',
          status: 'good',
          icon: '⚡',
          description: 'Waktu respons rata-rata API'
        },
        {
          name: 'Error Rate',
          value: Math.random() * 5,
          unit: '%',
          status: 'good',
          icon: '❌',
          description: 'Tingkat error dalam 1 jam terakhir'
        }
      ];

      // Determine status based on values
      const processedMetrics = mockMetrics.map(metric => {
        let status: 'good' | 'warning' | 'critical' = 'good';
        
        switch (metric.name) {
          case 'CPU Usage':
          case 'Memory Usage':
            if (metric.value > 80) status = 'critical';
            else if (metric.value > 60) status = 'warning';
            break;
          case 'Response Time':
            if (metric.value > 300) status = 'critical';
            else if (metric.value > 150) status = 'warning';
            break;
          case 'Error Rate':
            if (metric.value > 3) status = 'critical';
            else if (metric.value > 1) status = 'warning';
            break;
        }
        
        return { ...metric, status };
      });

      setMetrics(processedMetrics);

      // Determine overall status
      const hasCritical = processedMetrics.some(m => m.status === 'critical');
      const hasWarning = processedMetrics.some(m => m.status === 'warning');

      if (hasCritical) setOverallStatus('critical');
      else if (hasWarning) setOverallStatus('warning');
      else setOverallStatus('good');

      // Update last updated time
      updateLastUpdated();

    } catch (error) {
      console.error('Error fetching system metrics:', error);
    }
  };

  const updateUptime = () => {
    // Simulate uptime (in a real app, this would come from the server)
    const startTime = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    setUptime(`${days}d ${hours}h ${minutes}m`);
  };

  const updateLastUpdated = () => {
    if (isClient) {
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'MB') {
      return `${value.toFixed(1)} ${unit}`;
    } else if (unit === 'ms') {
      return `${value.toFixed(0)} ${unit}`;
    } else if (unit === '%') {
      return `${value.toFixed(1)}${unit}`;
    } else {
      return `${value.toFixed(0)}${unit}`;
    }
  };

  const overallColors = statusColors[overallStatus];

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-2 py-1 rounded-full border ${overallColors.bg} ${overallColors.border}`}>
            <div className={`w-2 h-2 rounded-full ${overallColors.dot} animate-pulse`}></div>
            <span className={`text-xs font-medium ${overallColors.text}`}>
              {overallStatus === 'good' ? 'Healthy' : overallStatus === 'warning' ? 'Warning' : 'Critical'}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-400">Uptime</p>
          <p className="text-sm font-semibold text-green-400">{uptime}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => {
          const colors = statusColors[metric.status];
          
          return (
            <div
              key={metric.name}
              className={`
                p-4 rounded-lg border transition-all duration-300 hover:scale-105
                ${colors.bg} ${colors.border}
                animate-fade-in
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{metric.icon}</span>
                  <h3 className="text-xs font-medium text-white truncate">{metric.name}</h3>
                </div>
                <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0 ml-2`}></div>
              </div>
              
              <div className="mb-2">
                <p className={`text-xl font-bold ${colors.text} break-words`}>
                  {formatValue(metric.value, metric.unit)}
                </p>
              </div>

              <p className="text-xs text-gray-400 leading-tight">{metric.description}</p>
              
              {/* Progress Bar for percentage metrics */}
              {metric.unit === '%' && (
                <div className="mt-3">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        metric.status === 'critical' ? 'bg-red-500' :
                        metric.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(metric.value, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Last updated: {isClient ? lastUpdated : '--:--:--'}</span>
          <button
            onClick={fetchSystemMetrics}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
