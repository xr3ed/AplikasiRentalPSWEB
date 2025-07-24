'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  category: string;
}

export const KeyboardShortcuts = () => {
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  const shortcuts: Shortcut[] = [
    // Navigation shortcuts
    {
      key: 'g d',
      description: 'Go to Dashboard',
      action: () => router.push('/management'),
      category: 'Navigation'
    },
    {
      key: 'g t',
      description: 'Go to TV Management',
      action: () => router.push('/management/tvs'),
      category: 'Navigation'
    },
    {
      key: 'g m',
      description: 'Go to Members',
      action: () => router.push('/management/members'),
      category: 'Navigation'
    },
    {
      key: 'g p',
      description: 'Go to Packages',
      action: () => router.push('/management/packages'),
      category: 'Navigation'
    },
    {
      key: 'g r',
      description: 'Go to Transactions',
      action: () => router.push('/management/transactions'),
      category: 'Navigation'
    },
    {
      key: 'g a',
      description: 'Go to Analytics',
      action: () => router.push('/management/analytics'),
      category: 'Navigation'
    },
    {
      key: 'g s',
      description: 'Go to Settings',
      action: () => router.push('/management/settings'),
      category: 'Navigation'
    },
    // Action shortcuts
    {
      key: 'n t',
      description: 'Add New TV',
      action: () => router.push('/management/tvs/add'),
      category: 'Actions'
    },
    {
      key: 'n m',
      description: 'Add New Member',
      action: () => router.push('/management/members/add'),
      category: 'Actions'
    },
    {
      key: 'n p',
      description: 'Create New Package',
      action: () => router.push('/management/packages/add'),
      category: 'Actions'
    },
    // System shortcuts
    {
      key: '?',
      description: 'Show Keyboard Shortcuts',
      action: () => setShowHelp(true),
      category: 'System'
    },
    {
      key: 'Escape',
      description: 'Close Modals/Dialogs',
      action: () => setShowHelp(false),
      category: 'System'
    }
  ];

  useEffect(() => {
    let keySequence = '';
    let sequenceTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle special keys
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      if (e.key === 'Escape') {
        setShowHelp(false);
        keySequence = '';
        return;
      }

      // Skip if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Handle key sequences (like 'g d' for go to dashboard)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        keySequence += e.key.toLowerCase();
        
        // Clear sequence after 2 seconds
        clearTimeout(sequenceTimeout);
        sequenceTimeout = setTimeout(() => {
          keySequence = '';
        }, 2000);

        // Check for matching shortcuts
        const matchingShortcut = shortcuts.find(s => s.key === keySequence);
        if (matchingShortcut) {
          e.preventDefault();
          matchingShortcut.action();
          keySequence = '';
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(sequenceTimeout);
    };
  }, [router, shortcuts]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  if (!showHelp) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => setShowHelp(false)}
      />
      
      {/* Shortcuts Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50 px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-gray-400">Navigate faster with keyboard shortcuts</p>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="max-h-96 overflow-y-auto p-6 space-y-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between py-2">
                      <span className="text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center space-x-1">
                        {shortcut.key.split(' ').map((key, index) => (
                          <div key={index} className="flex items-center space-x-1">
                            {index > 0 && <span className="text-gray-500">then</span>}
                            <kbd className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-300 font-mono">
                              {key === ' ' ? 'Space' : key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-900/50 border-t border-gray-700">
            <p className="text-xs text-gray-400 text-center">
              Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">?</kbd> to show this help again, 
              or <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default KeyboardShortcuts;
