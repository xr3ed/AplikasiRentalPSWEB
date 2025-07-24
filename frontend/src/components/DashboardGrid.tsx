'use client';

import { ReactNode } from 'react';

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
}

interface DashboardGridItemProps {
  children: ReactNode;
  className?: string;
  span?: 1 | 2 | 3 | 4 | 6 | 12;
  rowSpan?: 1 | 2 | 3 | 4;
}

export const DashboardGrid = ({ children, className = '' }: DashboardGridProps) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 auto-rows-fr ${className}`}>
      {children}
    </div>
  );
};

export const DashboardGridItem = ({ 
  children, 
  className = '', 
  span = 1, 
  rowSpan = 1 
}: DashboardGridItemProps) => {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-2 lg:col-span-3',
    4: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4',
    6: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4',
    12: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4'
  };

  const rowSpanClasses = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
    4: 'row-span-4'
  };

  return (
    <div className={`${spanClasses[span]} ${rowSpanClasses[rowSpan]} ${className}`}>
      {children}
    </div>
  );
};

// Main content area component inspired by the design reference
interface MainContentAreaProps {
  children: ReactNode;
  className?: string;
}

export const MainContentArea = ({ children, className = '' }: MainContentAreaProps) => {
  return (
    <div className={`flex-1 space-y-4 ${className}`}>
      {children}
    </div>
  );
};

// Right panel component for contextual information
interface RightPanelProps {
  children: ReactNode;
  className?: string;
  isVisible?: boolean;
}

export const RightPanel = ({ children, className = '', isVisible = true }: RightPanelProps) => {
  if (!isVisible) return null;

  return (
    <div className={`w-full xl:w-80 space-y-4 ${className}`}>
      {children}
    </div>
  );
};

// Layout wrapper that combines main content and right panel
interface DashboardLayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
}

export const DashboardLayout = ({ children, rightPanel, className = '' }: DashboardLayoutProps) => {
  return (
    <div className={`flex flex-col xl:flex-row gap-4 xl:gap-6 ${className}`}>
      <MainContentArea className="flex-1">
        {children}
      </MainContentArea>
      {rightPanel && (
        <>
          {/* Vertical Separator for larger screens */}
          <div className="hidden xl:block w-px bg-gradient-to-b from-transparent via-gray-700/30 to-transparent mx-2"></div>
          <RightPanel className="xl:w-80 w-full" isVisible={true}>
            {rightPanel}
          </RightPanel>
        </>
      )}
    </div>
  );
};

export default DashboardGrid;
