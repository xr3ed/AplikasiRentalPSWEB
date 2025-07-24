'use client';

import { useEffect, useRef } from 'react';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface MetricCardWithChartProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: ChartDataPoint[];
  chartType?: 'line' | 'bar' | 'area';
  color?: 'red' | 'blue' | 'green' | 'purple' | 'yellow' | 'indigo';
  className?: string;
  onClick?: () => void;
}

const colorClasses = {
  red: {
    bg: 'from-red-900/20 to-red-800/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    accent: 'text-red-300',
    chart: '#ef4444'
  },
  blue: {
    bg: 'from-blue-900/20 to-blue-800/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    accent: 'text-blue-300',
    chart: '#3b82f6'
  },
  green: {
    bg: 'from-green-900/20 to-green-800/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    accent: 'text-green-300',
    chart: '#10b981'
  },
  purple: {
    bg: 'from-purple-900/20 to-purple-800/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    accent: 'text-purple-300',
    chart: '#8b5cf6'
  },
  yellow: {
    bg: 'from-yellow-900/20 to-yellow-800/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    accent: 'text-yellow-300',
    chart: '#f59e0b'
  },
  indigo: {
    bg: 'from-indigo-900/20 to-indigo-800/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    accent: 'text-indigo-300',
    chart: '#6366f1'
  }
};

export const MetricCardWithChart = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  chartData = [],
  chartType = 'line',
  color = 'blue',
  className = '',
  onClick,
  size = 'normal' // Add size prop
}: MetricCardWithChartProps & { size?: 'mini' | 'normal' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = colorClasses[color];

  useEffect(() => {
    if (!canvasRef.current || !chartData.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (chartData.length === 0) return;

    const padding = 4;
    const chartWidth = rect.width - padding * 2;
    const chartHeight = rect.height - padding * 2;

    // Get min and max values
    const values = chartData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    if (chartType === 'line' || chartType === 'area') {
      // Draw line/area chart
      const stepX = chartWidth / (chartData.length - 1 || 1);
      
      ctx.strokeStyle = colors.chart;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (chartType === 'area') {
        // Fill area
        ctx.fillStyle = colors.chart + '20';
        ctx.beginPath();
        ctx.moveTo(padding, padding + chartHeight);
        
        chartData.forEach((point, index) => {
          const x = padding + index * stepX;
          const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
          if (index === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.closePath();
        ctx.fill();
      }

      // Draw line
      ctx.beginPath();
      chartData.forEach((point, index) => {
        const x = padding + index * stepX;
        const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw points
      ctx.fillStyle = colors.chart;
      chartData.forEach((point, index) => {
        const x = padding + index * stepX;
        const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (chartType === 'bar') {
      // Draw bar chart
      const barWidth = chartWidth / chartData.length * 0.8;
      const barSpacing = chartWidth / chartData.length * 0.2;

      chartData.forEach((point, index) => {
        const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
        const barHeight = ((point.value - minValue) / valueRange) * chartHeight;
        const y = padding + chartHeight - barHeight;

        ctx.fillStyle = point.color || colors.chart;
        ctx.fillRect(x, y, barWidth, barHeight);
      });
    }
  }, [chartData, chartType, colors.chart]);

  // Size-based styling
  const sizeClasses = size === 'mini' ? {
    container: 'p-4',
    icon: 'text-lg',
    title: 'text-xs',
    value: 'text-lg',
    trend: 'text-xs',
    chart: 'h-10',
    subtitle: 'text-xs',
    spacing: 'mb-2'
  } : {
    container: 'p-6',
    icon: 'text-2xl',
    title: 'text-sm',
    value: 'text-2xl',
    trend: 'text-sm',
    chart: 'h-16',
    subtitle: 'text-xs',
    spacing: 'mb-4'
  };

  return (
    <div
      className={`
        relative ${sizeClasses.container} rounded-xl border backdrop-blur-sm transition-all duration-300
        bg-gradient-to-br ${colors.bg} ${colors.border}
        hover:scale-105 hover:shadow-xl hover:shadow-${color}-500/20
        before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none
        ${onClick ? 'cursor-pointer group' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className={`flex items-start justify-between ${sizeClasses.spacing}`}>
        <div className="flex items-center space-x-3">
          {icon && (
            <div className={`${sizeClasses.icon} ${colors.text}`}>
              {icon}
            </div>
          )}
          <div>
            <h3 className={`${sizeClasses.title} font-medium text-gray-400 mb-1`}>{title}</h3>
            <p className={`${sizeClasses.value} font-bold ${colors.text}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
        </div>

        {trend && (
          <div className={`flex items-center space-x-1 ${sizeClasses.trend} ${
            trend.isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            <span>{trend.isPositive ? '↗' : '↘'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className={`${sizeClasses.chart} ${size === 'mini' ? 'mb-2' : 'mb-3'}`}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className={`${sizeClasses.subtitle} ${colors.accent} opacity-75`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default MetricCardWithChart;
