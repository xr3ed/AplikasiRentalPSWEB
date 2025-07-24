'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  setIsNavigating: (loading: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavigating: false,
  setIsNavigating: () => {},
});

export const useNavigation = () => useContext(NavigationContext);

interface NavigationProviderProps {
  children: React.ReactNode;
}

export default function NavigationProvider({ children }: NavigationProviderProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Start navigation loading immediately
    setIsNavigating(true);

    // End navigation loading after content is ready
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 600); // Longer duration to cover any flicker

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ isNavigating, setIsNavigating }}>
      {children}
      
      {/* Global Navigation Splash Screen */}
      {isNavigating && (
        <div
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            animation: 'splash-fade-in 0.2s ease-out forwards'
          }}
        >
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-transparent to-blue-500/30"></div>
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl animate-ping"></div>
          </div>

          {/* Splash Content */}
          <div className="relative z-10 flex flex-col items-center space-y-6">
            {/* Enhanced Logo */}
            <div className="relative">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-3xl shadow-2xl shadow-purple-500/40 animate-logo-pulse">
                <span className="text-4xl">🎮</span>
              </div>
              {/* Multiple Pulse Rings */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-3xl animate-ping"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-blue-600/10 rounded-3xl animate-ping" style={{ animationDelay: '0.3s' }}></div>
            </div>

            {/* Brand Text */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                PS Rental
              </h2>
              <p className="text-gray-400 text-sm">Management System</p>
            </div>

            {/* Enhanced Loading Indicator */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-500 border-t-transparent"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border border-purple-400 opacity-30"></div>
              </div>
              <span className="text-white font-medium">Loading page...</span>
            </div>

            {/* Progress Bar */}
            <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </NavigationContext.Provider>
  );
}
