'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string;
  description: string;
}

interface TabNavigationProps {
  className?: string;
}

export const TabNavigation = ({ className = '' }: TabNavigationProps) => {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const tabs: TabItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/management',
      icon: '📊',
      description: 'Overview dan statistik sistem'
    },
    {
      id: 'tvs',
      label: 'TV Management',
      href: '/management/tvs',
      icon: '📺',
      description: 'Kelola TV dan sesi gaming'
    },
    {
      id: 'members',
      label: 'Members',
      href: '/management/members',
      icon: '👥',
      description: 'Manajemen member dan paket'
    },
    {
      id: 'packages',
      label: 'Packages',
      href: '/management/packages',
      icon: '📦',
      description: 'Kelola paket gaming'
    },
    {
      id: 'transactions',
      label: 'Transactions',
      href: '/management/transactions',
      icon: '💰',
      description: 'Riwayat dan laporan transaksi'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      href: '/management/analytics',
      icon: '📈',
      description: 'Laporan dan analisis performa'
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/management/settings',
      icon: '⚙️',
      description: 'Konfigurasi sistem'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/management') {
      return pathname === '/management';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 ${className}`}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative flex-shrink-0">
              <Link
                href={tab.href}
                className={`
                  flex items-center space-x-2 px-4 py-3 text-sm font-medium
                  transition-all duration-300 border-b-2 whitespace-nowrap
                  ${isActive(tab.href)
                    ? 'text-red-400 border-red-400 bg-red-500/10'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                  }
                `}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                    {tab.badge}
                  </span>
                )}
              </Link>

              {/* Tooltip */}
              {hoveredTab === tab.id && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700 whitespace-nowrap animate-fade-in">
                    {tab.description}
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile Tab Selector */}
        <div className="lg:hidden py-3">
          <select
            value={pathname}
            onChange={(e) => window.location.href = e.target.value}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.href}>
                {tab.icon} {tab.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;
