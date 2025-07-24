'use client';

import { useState } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import BreadcrumbNavigation from '@/components/BreadcrumbNavigation';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import Link from 'next/link';

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Mobile Header - visible only on mobile */}
      <div className="md:hidden bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <Link href="/management" className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg shadow-lg shadow-purple-500/25">
              <span className="text-lg">🎮</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">PS Rental</h1>
              <p className="text-xs text-gray-400">Management</p>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/30 hover:border-purple-400/50 rounded-xl text-purple-300 hover:text-purple-200 transition-all duration-300 hover:scale-105 backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Dashboard Utama</span>
          </Link>
        </div>
      </div>

      {/* Sidebar Navigation - hidden on mobile */}
      <SidebarNavigation onCollapseChange={setSidebarCollapsed} />

      {/* Main Content Area */}
      <div
        className={`flex flex-col transition-all duration-300 relative ${
          sidebarCollapsed ? 'md:ml-16 ml-0' : 'md:ml-64 ml-0'
        }`}
        suppressHydrationWarning={true}
      >
        {/* Breadcrumb Navigation - hidden on mobile */}
        <div
          className="hidden md:flex items-center p-4 border-b border-gray-700/50 bg-gray-800/30 backdrop-blur-sm h-[73px] shadow-lg shadow-black/20"
          suppressHydrationWarning={true}
        >
          <BreadcrumbNavigation />
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts />
    </div>
  );
}