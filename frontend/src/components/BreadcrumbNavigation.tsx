'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: string;
  description?: string;
}

interface BreadcrumbNavigationProps {
  className?: string;
  customItems?: BreadcrumbItem[];
}

export const BreadcrumbNavigation = ({ className = '', customItems }: BreadcrumbNavigationProps) => {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (customItems) return customItems;

    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard Utama', href: '/', icon: '🏠', description: 'Halaman utama sistem' },
      { label: 'Dashboard', href: '/management', icon: '📊', description: 'Overview dan statistik' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      if (segment === 'management') return; // Skip management segment as it's already in dashboard
      
      let label = segment.charAt(0).toUpperCase() + segment.slice(1);
      let icon = '';

      // Map segments to proper labels, icons, and descriptions
      let description = 'Overview dan statistik';
      switch (segment) {
        case 'tvs':
          label = 'Management TV';
          icon = '📺';
          description = 'Kelola TV dan sesi gaming';
          break;
        case 'members':
          label = 'Anggota';
          icon = '👥';
          description = 'Manajemen member dan paket';
          break;
        case 'packages':
          label = 'Paket';
          icon = '📦';
          description = 'Kelola paket gaming';
          break;
        case 'transactions':
          label = 'Transaksi';
          icon = '💰';
          description = 'Riwayat dan laporan transaksi';
          break;
        case 'analytics':
          label = 'Analitik';
          icon = '📈';
          description = 'Laporan dan analisis';
          break;
        case 'settings':
          label = 'Pengaturan';
          icon = '⚙️';
          description = 'Konfigurasi sistem';
          break;
        default:
          // For dynamic segments like IDs
          if (/^\d+$/.test(segment)) {
            label = `#${segment}`;
            icon = '🔍';
            description = 'Detail item';
          }
      }

      breadcrumbs.push({ label, href: currentPath, icon, description });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <nav
      className={`flex items-center space-x-2 text-sm ${className}`}
      aria-label="Breadcrumb"
      suppressHydrationWarning={true}
    >
      {breadcrumbs.map((item, index) => (
        <div key={item.href} className="flex items-center space-x-2" suppressHydrationWarning={true}>
          {index > 0 && (
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}

          {index === breadcrumbs.length - 1 ? (
            // Current page - enhanced sidebar-style display
            <div
              className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl border border-purple-500/30 backdrop-blur-sm"
              suppressHydrationWarning={true}
            >
              {item.icon && <span className="text-lg">{item.icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-purple-400 truncate">{item.label}</p>
                <p className="text-xs text-purple-300/75 truncate">{item.description || 'Overview dan statistik'}</p>
              </div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            </div>
          ) : (
            // Clickable breadcrumb - enhanced sidebar-style functionality
            <Link
              href={item.href}
              className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-purple-600/10 hover:to-blue-600/10 hover:border-purple-500/20 border border-transparent rounded-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm group"
            >
              {item.icon && <span className="text-lg group-hover:scale-110 transition-transform">{item.icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="font-medium group-hover:text-purple-400 transition-colors truncate">{item.label}</p>
                <p className="text-xs opacity-75 group-hover:text-purple-300 transition-colors truncate">{item.description || 'Overview dan statistik'}</p>
              </div>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};

export default BreadcrumbNavigation;
