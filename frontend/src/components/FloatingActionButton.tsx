'use client';

import { useState } from 'react';
import Link from 'next/link';

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: string;
  color: string;
  description: string;
}

interface FloatingActionButtonProps {
  className?: string;
}

export const FloatingActionButton = ({ className = '' }: FloatingActionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const quickActions: QuickAction[] = [
    {
      id: 'add-tv',
      label: 'Tambah TV',
      href: '/management/tvs/add',
      icon: '📺',
      color: 'from-blue-600 to-blue-700',
      description: 'Daftarkan TV baru'
    },
    {
      id: 'add-member',
      label: 'Tambah Member',
      href: '/management/members/add',
      icon: '👤',
      color: 'from-green-600 to-green-700',
      description: 'Registrasi member baru'
    },
    {
      id: 'add-package',
      label: 'Buat Paket',
      href: '/management/packages/add',
      icon: '📦',
      color: 'from-purple-600 to-purple-700',
      description: 'Buat paket gaming baru'
    },
    {
      id: 'view-transactions',
      label: 'Transaksi',
      href: '/management/transactions',
      icon: '💰',
      color: 'from-orange-600 to-orange-700',
      description: 'Lihat transaksi terbaru'
    },
    {
      id: 'analytics',
      label: 'Laporan',
      href: '/management/analytics',
      icon: '📊',
      color: 'from-indigo-600 to-indigo-700',
      description: 'Analisis performa'
    }
  ];

  const toggleFAB = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      {/* Quick Action Items */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 space-y-3 animate-fade-in">
          {quickActions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-center space-x-3 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Action Label */}
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl border border-gray-700 whitespace-nowrap">
                <div className="font-medium">{action.label}</div>
                <div className="text-xs text-gray-400">{action.description}</div>
              </div>

              {/* Action Button */}
              <Link
                href={action.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center justify-center w-12 h-12 rounded-full shadow-lg
                  bg-gradient-to-r ${action.color} text-white
                  transform hover:scale-110 transition-all duration-300
                  hover:shadow-xl border-2 border-white/20
                `}
              >
                <span className="text-xl">{action.icon}</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={toggleFAB}
        className={`
          flex items-center justify-center w-14 h-14 rounded-full shadow-lg
          bg-gradient-to-r from-red-600 to-red-700 text-white
          transform hover:scale-110 transition-all duration-300
          hover:shadow-xl border-2 border-white/20
          ${isOpen ? 'rotate-45' : 'rotate-0'}
        `}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default FloatingActionButton;
