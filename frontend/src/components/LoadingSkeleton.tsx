/**
 * Modern LoadingSkeleton component with enhanced animations
 * Aligned with the new dashboard design system
 */
interface LoadingSkeletonProps {
    /** Number of skeleton rows to display */
    rows?: number;
    /** Type of skeleton layout */
    type?: 'table' | 'card' | 'dashboard' | 'list';
    /** Additional CSS classes */
    className?: string;
    /** Show shimmer animation effect */
    showShimmer?: boolean;
}

export const TableSkeleton = ({ rows = 5, className = '' }: { rows?: number; className?: string }) => {
    return (
        <div className={`animate-pulse ${className}`} suppressHydrationWarning={true}>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 border-b border-gray-800" suppressHydrationWarning={true}>
                    <div className="h-4 bg-gray-700 rounded w-8" suppressHydrationWarning={true}></div>
                    <div className="h-4 bg-gray-700 rounded w-32" suppressHydrationWarning={true}></div>
                    <div className="h-4 bg-gray-700 rounded w-28" suppressHydrationWarning={true}></div>
                    <div className="h-4 bg-gray-700 rounded w-16" suppressHydrationWarning={true}></div>
                    <div className="flex space-x-2" suppressHydrationWarning={true}>
                        <div className="h-8 bg-gray-700 rounded w-20" suppressHydrationWarning={true}></div>
                        <div className="h-8 bg-gray-700 rounded w-16" suppressHydrationWarning={true}></div>
                        <div className="h-8 bg-gray-700 rounded w-16" suppressHydrationWarning={true}></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const CardSkeleton = ({ rows = 3, className = '' }: { rows?: number; className?: string }) => {
    return (
        <div className={`space-y-4 ${className}`} suppressHydrationWarning={true}>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4 animate-pulse" suppressHydrationWarning={true}>
                    <div className="flex items-center space-x-3 mb-3" suppressHydrationWarning={true}>
                        <div className="w-10 h-10 bg-gray-700 rounded-full" suppressHydrationWarning={true}></div>
                        <div className="flex-1" suppressHydrationWarning={true}>
                            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" suppressHydrationWarning={true}></div>
                            <div className="h-3 bg-gray-700 rounded w-1/2" suppressHydrationWarning={true}></div>
                        </div>
                        <div className="h-6 bg-gray-700 rounded w-16" suppressHydrationWarning={true}></div>
                    </div>
                    <div className="flex space-x-2" suppressHydrationWarning={true}>
                        <div className="h-8 bg-gray-700 rounded flex-1" suppressHydrationWarning={true}></div>
                        <div className="h-8 bg-gray-700 rounded flex-1" suppressHydrationWarning={true}></div>
                        <div className="h-8 bg-gray-700 rounded flex-1" suppressHydrationWarning={true}></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const LoadingSkeleton = ({ rows = 5, type = 'table', className = '' }: LoadingSkeletonProps) => {
    if (type === 'card') {
        return <CardSkeleton rows={rows} className={className} />;
    }
    return <TableSkeleton rows={rows} className={className} />;
};

export default LoadingSkeleton;
