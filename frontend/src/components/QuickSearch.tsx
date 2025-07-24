'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface SearchResult {
  id: string;
  type: 'member' | 'tv' | 'transaction' | 'package';
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

interface QuickSearchProps {
  className?: string;
}

const searchIcons = {
  member: '👤',
  tv: '📺',
  transaction: '💰',
  package: '📦'
};

const searchColors = {
  member: 'text-blue-400',
  tv: 'text-green-400',
  transaction: 'text-yellow-400',
  package: 'text-purple-400'
};

export const QuickSearch = ({ className = '' }: QuickSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle arrow keys and enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? results.length - 1 : prev - 1);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const result = results[selectedIndex];
        if (result) {
          window.location.href = result.href;
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Search function
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const searchData = async () => {
      setLoading(true);
      try {
        // Simulate API calls (in real app, these would be actual API calls)
        const mockResults: SearchResult[] = [
          {
            id: 'member-1',
            type: 'member',
            title: 'John Doe',
            subtitle: '+62812345678',
            href: '/management/members/1',
            icon: searchIcons.member
          },
          {
            id: 'tv-1',
            type: 'tv',
            title: 'TV Gaming #1',
            subtitle: 'Status: Aktif',
            href: '/management/tvs/1',
            icon: searchIcons.tv
          },
          {
            id: 'package-1',
            type: 'package',
            title: 'Paket 1 Jam',
            subtitle: 'Rp 15.000 - 60 menit',
            href: '/management/packages/1',
            icon: searchIcons.package
          },
          {
            id: 'transaction-1',
            type: 'transaction',
            title: 'Transaksi #12345',
            subtitle: 'Rp 15.000 - 2 jam lalu',
            href: '/management/transactions/12345',
            icon: searchIcons.transaction
          }
        ];

        // Filter results based on query
        const filteredResults = mockResults.filter(result =>
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.subtitle.toLowerCase().includes(query.toLowerCase())
        );

        setResults(filteredResults);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchData, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700
          rounded-lg text-gray-400 hover:text-white hover:border-gray-600
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50
          ${className}
        `}
      >
        <span className="text-lg">🔍</span>
        <span className="text-sm">Cari...</span>
        <div className="hidden sm:flex items-center space-x-1 text-xs bg-gray-700 px-2 py-1 rounded">
          <span>⌘</span>
          <span>K</span>
        </div>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => setIsOpen(false)}
          />

          {/* Search Dialog */}
          <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[60] px-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center p-4 border-b border-gray-700">
                <span className="text-xl mr-3">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari member, TV, transaksi, atau paket..."
                  className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-lg"
                  autoComplete="off"
                />
                {loading && (
                  <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                )}
              </div>

              {/* Search Results */}
              <div ref={resultsRef} className="max-h-96 overflow-y-auto">
                {query && !loading && results.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-2">🔍</div>
                    <p>Tidak ada hasil untuk "{query}"</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="py-2">
                    {results.map((result, index) => (
                      <Link
                        key={result.id}
                        href={result.href}
                        onClick={() => setIsOpen(false)}
                        className={`
                          flex items-center space-x-3 px-4 py-3 hover:bg-gray-700/50 transition-colors
                          ${index === selectedIndex ? 'bg-gray-700/50' : ''}
                        `}
                      >
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center
                          bg-gray-700 ${searchColors[result.type]}
                        `}>
                          <span className="text-lg">{result.icon}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">
                            {result.title}
                          </h3>
                          <p className="text-sm text-gray-400 truncate">
                            {result.subtitle}
                          </p>
                        </div>
                        
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          {result.type}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : !query ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-2">⌨️</div>
                    <p className="mb-2">Mulai mengetik untuk mencari</p>
                    <div className="text-sm space-y-1">
                      <p>• Member: nama atau nomor telepon</p>
                      <p>• TV: nama atau status</p>
                      <p>• Transaksi: ID atau jumlah</p>
                      <p>• Paket: nama atau harga</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↑↓</kbd>
                      <span>navigasi</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↵</kbd>
                      <span>pilih</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">esc</kbd>
                      <span>tutup</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default QuickSearch;
