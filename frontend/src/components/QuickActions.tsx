'use client';

import { useState } from 'react';
import Link from 'next/link';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: 'red' | 'green' | 'blue' | 'yellow' | 'purple';
  href?: string;
  onClick?: () => void;
  badge?: string;
}

interface QuickActionsProps {
  className?: string;
}

const colorClasses = {
  red: {
    bg: 'bg-gradient-to-br from-red-600 to-red-700',
    hover: 'hover:from-red-500 hover:to-red-600',
    shadow: 'shadow-red-500/25',
    ring: 'focus:ring-red-500/50'
  },
  green: {
    bg: 'bg-gradient-to-br from-green-600 to-green-700',
    hover: 'hover:from-green-500 hover:to-green-600',
    shadow: 'shadow-green-500/25',
    ring: 'focus:ring-green-500/50'
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-600 to-blue-700',
    hover: 'hover:from-blue-500 hover:to-blue-600',
    shadow: 'shadow-blue-500/25',
    ring: 'focus:ring-blue-500/50'
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-600 to-yellow-700',
    hover: 'hover:from-yellow-500 hover:to-yellow-600',
    shadow: 'shadow-yellow-500/25',
    ring: 'focus:ring-yellow-500/50'
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-600 to-purple-700',
    hover: 'hover:from-purple-500 hover:to-purple-600',
    shadow: 'shadow-purple-500/25',
    ring: 'focus:ring-purple-500/50'
  }
};

export const QuickActions = ({ className = '' }: QuickActionsProps) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
    {
      id: 'start-session',
      title: 'Mulai Sesi',
      description: 'Mulai sesi gaming baru',
      icon: '🎮',
      color: 'red',
      href: '/management/tvs'
    },
    {
      id: 'add-member',
      title: 'Tambah Member',
      description: 'Daftarkan member baru',
      icon: '👤',
      color: 'green',
      href: '/management/members'
    },
    {
      id: 'create-package',
      title: 'Buat Paket',
      description: 'Buat paket gaming baru',
      icon: '📦',
      color: 'blue',
      href: '/management/packages'
    },
    {
      id: 'view-transactions',
      title: 'Transaksi',
      description: 'Lihat riwayat transaksi',
      icon: '💰',
      color: 'yellow',
      href: '/management/transactions'
    },
    {
      id: 'system-settings',
      title: 'Pengaturan',
      description: 'Kelola sistem',
      icon: '⚙️',
      color: 'purple',
      onClick: () => alert('Fitur pengaturan akan segera hadir!')
    }
  ];

  const ActionButton = ({ action }: { action: QuickAction }) => {
    const colors = colorClasses[action.color];
    const isHovered = hoveredAction === action.id;

    const buttonContent = (
      <div
        className={`
          relative group p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm
          ${colors.bg} ${colors.hover} ${colors.shadow}
          transform transition-all duration-300 ease-out
          hover:scale-105 hover:shadow-xl hover:-translate-y-1
          focus:outline-none focus:ring-2 ${colors.ring}
          ${isHovered ? 'shadow-xl scale-105 -translate-y-1' : 'shadow-lg'}
        `}
        onMouseEnter={() => setHoveredAction(action.id)}
        onMouseLeave={() => setHoveredAction(null)}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 rounded-xl opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 group-hover:animate-pulse"></div>
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="text-3xl transform transition-transform duration-300 group-hover:scale-110">
              {action.icon}
            </div>
            {action.badge && (
              <span className="px-2 py-1 text-xs font-semibold bg-white/20 rounded-full">
                {action.badge}
              </span>
            )}
          </div>
          
          <h3 className="text-lg font-bold text-white mb-1 group-hover:text-white/90 transition-colors">
            {action.title}
          </h3>
          
          <p className="text-sm text-white/70 group-hover:text-white/80 transition-colors">
            {action.description}
          </p>

          {/* Arrow Icon */}
          <div className="absolute top-4 right-4 text-white/50 transform transition-all duration-300 group-hover:text-white/80 group-hover:translate-x-1">
            →
          </div>
        </div>

        {/* Ripple Effect */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300"></div>
        </div>
      </div>
    );

    if (action.href) {
      return (
        <Link href={action.href} className="block">
          {buttonContent}
        </Link>
      );
    }

    return (
      <button onClick={action.onClick} className="block w-full text-left">
        {buttonContent}
      </button>
    );
  };

  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Quick Actions</h2>
        <div className="text-sm text-gray-400">Aksi Cepat</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {quickActions.map((action) => (
          <ActionButton key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
