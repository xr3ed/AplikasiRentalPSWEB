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

interface TopNavigationProps {
  className?: string;
}

export const TopNavigation = ({ className = '' }: TopNavigationProps) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/management',
      icon: '',
      description: 'Overview dan statistik'
    },
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
    {
      id: 'settings',
      label: 'Pengaturan',
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

  const handleDropdownToggle = (itemId: string) => {
    setActiveDropdown(activeDropdown === itemId ? null : itemId);
  };

  return (
    <nav className={`bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 ${className}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4">
            <Link href="/management" className="flex items-center space-x-3 group">
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-2 rounded-lg shadow-lg shadow-red-500/25 group-hover:shadow-red-500/40 transition-all duration-300">
                <span className="text-xl">🎮</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                  PS Rental
                </h1>
                <p className="text-xs text-gray-400">Management</p>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <div key={item.id} className="relative">
                <Link
                  href={item.href}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-300 transform hover:scale-105
                    ${isActive(item.href)
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }
                  `}
                  onMouseEnter={() => setActiveDropdown(item.id)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Tooltip */}
                {activeDropdown === item.id && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-gray-700 whitespace-nowrap animate-fade-in">
                      {item.description}
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main Dashboard Link */}
          <Link
            href="/"
            className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 hover:border-red-500/50 rounded-lg transition-all duration-300 hover:scale-105 group"
            title="Kembali ke Dashboard Utama"
          >
            <svg className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              Main Dashboard
            </span>
          </Link>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => handleDropdownToggle('mobile-menu')}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {activeDropdown === 'mobile-menu' && (
          <div className="lg:hidden border-t border-gray-700/50 py-4 animate-fade-in">
            {/* Main Dashboard Link for Mobile */}
            <div className="mb-4">
              <Link
                href="/"
                onClick={() => setActiveDropdown(null)}
                className="flex items-center space-x-3 p-3 rounded-lg text-sm font-medium bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 hover:border-red-500/50 text-gray-300 hover:text-white transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <div>
                  <div>Main Dashboard</div>
                  <div className="text-xs opacity-70">Kembali ke dashboard utama</div>
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveDropdown(null)}
                  className={`
                    flex items-center space-x-3 p-3 rounded-lg text-sm font-medium
                    transition-all duration-300
                    ${isActive(item.href)
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <div>{item.label}</div>
                    <div className="text-xs opacity-70">{item.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default TopNavigation;
