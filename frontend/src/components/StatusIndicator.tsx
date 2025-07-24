'use client';

import { useEffect, useState } from 'react';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'error';
  label: string;
  description?: string;
  className?: string;
}

const statusConfig = {
  online: {
    color: 'green',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
    dotColor: 'bg-green-400',
    icon: '✓'
  },
  offline: {
    color: 'gray',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    textColor: 'text-gray-400',
    dotColor: 'bg-gray-400',
    icon: '○'
  },
  warning: {
    color: 'yellow',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    dotColor: 'bg-yellow-400',
    icon: '⚠'
  },
  error: {
    color: 'red',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    dotColor: 'bg-red-400',
    icon: '✕'
  }
};

export const StatusIndicator = ({ 
  status, 
  label, 
  description, 
  className = '' 
}: StatusIndicatorProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const config = statusConfig[status];

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className={`
      flex items-center space-x-3 p-3 rounded-lg border transition-all duration-300
      ${config.bgColor} ${config.borderColor}
      ${isAnimating ? 'animate-scale-in' : ''}
      ${className}
    `}>
      {/* Status Dot */}
      <div className="relative">
        <div className={`
          w-3 h-3 rounded-full transition-all duration-300
          ${config.dotColor}
          ${status === 'online' ? 'animate-pulse' : ''}
        `} />
        {status === 'online' && (
          <div className={`
            absolute inset-0 w-3 h-3 rounded-full animate-ping
            ${config.dotColor} opacity-75
          `} />
        )}
      </div>

      {/* Status Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${config.textColor}`}>
            {label}
          </span>
          <span className={`text-xs ${config.textColor} opacity-75`}>
            {config.icon}
          </span>
        </div>
        {description && (
          <p className="text-xs text-gray-400 truncate mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatusIndicator;
