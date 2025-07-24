'use client';

import { useEffect, useState } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'gray';
  className?: string;
  onClick?: () => void;
}

const colorClasses = {
  red: {
    bg: 'bg-gradient-to-br from-red-900/20 to-red-800/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    value: 'text-red-400',
    trend: 'text-red-400'
  },
  green: {
    bg: 'bg-gradient-to-br from-green-900/20 to-green-800/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    value: 'text-green-400',
    trend: 'text-green-400'
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-900/20 to-blue-800/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    value: 'text-blue-400',
    trend: 'text-blue-400'
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    value: 'text-yellow-400',
    trend: 'text-yellow-400'
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-900/20 to-purple-800/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    value: 'text-purple-400',
    trend: 'text-purple-400'
  },
  gray: {
    bg: 'bg-gradient-to-br from-gray-800 to-gray-900',
    border: 'border-gray-700',
    icon: 'text-gray-400',
    value: 'text-white',
    trend: 'text-gray-400'
  }
};

export const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  color = 'gray', 
  className = '',
  onClick 
}: StatCardProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const colors = colorClasses[color];

  useEffect(() => {
    setIsVisible(true);
    
    // Animate number if it's a number
    if (typeof value === 'number') {
      let start = 0;
      const end = value;
      const duration = 1000;
      const increment = end / (duration / 16);

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setAnimatedValue(end);
          clearInterval(timer);
        } else {
          setAnimatedValue(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [value]);

  const displayValue = typeof value === 'number' ? animatedValue : value;

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-sm
        ${colors.bg} ${colors.border}
        ${onClick ? 'cursor-pointer hover:scale-105' : ''}
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12"></div>
      </div>

      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className={`text-2xl font-bold ${colors.value} transition-all duration-300`}>
                {displayValue}
              </p>
              {trend && (
                <div className={`flex items-center text-xs ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  <span className="mr-1">
                    {trend.isPositive ? '↗' : '↘'}
                  </span>
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          
          {icon && (
            <div className={`text-2xl ${colors.icon} opacity-80`}>
              {icon}
            </div>
          )}
        </div>

        {/* Hover Effect */}
        {onClick && (
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
        )}
      </div>

      {/* Loading Animation */}
      {typeof value === 'number' && animatedValue < value && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 overflow-hidden">
          <div className={`h-full bg-gradient-to-r from-${color}-500 to-${color}-400 animate-pulse`}></div>
        </div>
      )}
    </div>
  );
};

export default StatCard;
