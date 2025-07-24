'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  description: string;
  badge?: string;
}

interface SidebarNavigationProps {
  className?: string;
  onCollapseChange?: (collapsed: boolean) => void;
}

export const SidebarNavigation = ({ className = '', onCollapseChange }: SidebarNavigationProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      id: 'tvs',
      label: 'Management TV',
      href: '/management/tvs',
      icon: '📺',
      description: 'Kelola TV dan sesi gaming'
    },
    {
      id: 'members',
      label: 'Anggota',
      href: '/management/members',
      icon: '👥',
      description: 'Manajemen member dan paket'
    },
    {
      id: 'packages',
      label: 'Paket',
      href: '/management/packages',
      icon: '📦',
      description: 'Kelola paket gaming'
    },
    {
      id: 'transactions',
      label: 'Transaksi',
      href: '/management/transactions',
      icon: '💰',
      description: 'Riwayat dan laporan transaksi'
    },
    {
      id: 'analytics',
      label: 'Analitik',
      href: '/management/analytics',
      icon: '📈',
      description: 'Laporan dan analisis'
    },
  ];

  const isActive = (href: string) => {
    if (href === '/management') {
      return pathname === '/management';
    }
    return pathname.startsWith(href);
  };

  return (
    <div
      className={`fixed left-0 top-0 h-full bg-gray-900/95 backdrop-blur-sm border-r border-gray-700/50 transition-all duration-300 z-50 shadow-2xl shadow-black/50 ${
        isCollapsed ? 'w-16' : 'w-64'
      } ${className} hidden md:block`}
      suppressHydrationWarning={true}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50 h-[73px]">
        {!isCollapsed && (
          <Link href="/management" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-all duration-300">
              <span className="text-lg">🎮</span>
            </div>
            <div suppressHydrationWarning={true}>
              <h1 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                PS Rental
              </h1>
              <p className="text-xs text-gray-400">Management</p>
            </div>
          </Link>
        )}
        
        <button
          onClick={handleToggleCollapse}
          className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all duration-200"
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Enhanced Dashboard Navigation - Transferred from Breadcrumb */}
      <div className="px-4 py-2 border-b border-gray-700/50">
        <Link
          href="/management"
          className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-300 group ${
            pathname === '/management'
              ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-purple-400'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50 hover:scale-105'
          }`}
        >
          <span className="text-lg flex-shrink-0">🏠</span>
          {!isCollapsed && (
            <div className="flex-1 min-w-0" suppressHydrationWarning={true}>
              <p className="font-medium truncate">Dashboard</p>
              <p className="text-xs opacity-75 truncate">Overview dan statistik</p>
            </div>
          )}
          {pathname === '/management' && !isCollapsed && (
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group ${
              isActive(item.href)
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!isCollapsed && (
              <div className="flex-1 min-w-0" suppressHydrationWarning={true}>
                <p className="font-medium truncate">{item.label}</p>
                <p className="text-xs opacity-75 truncate">{item.description}</p>
              </div>
            )}
            {item.badge && !isCollapsed && (
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-gray-700/50" suppressHydrationWarning={true}>
        <div
          className={`flex items-center space-x-3 p-3 rounded-xl bg-gray-800/30 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          suppressHydrationWarning={true}
        >
          <div
            className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0"
            suppressHydrationWarning={true}
          >
            <span className="text-sm font-bold text-white">A</span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0" suppressHydrationWarning={true}>
              <p className="font-medium text-white truncate">Admin</p>
              <p className="text-xs text-gray-400 truncate">Administrator</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SidebarNavigation;
