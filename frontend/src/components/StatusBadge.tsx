import React from 'react';

/**
 * Modern StatusBadge component with interactive features and animations
 * Aligned with the new dashboard design system
 */
interface StatusBadgeProps {
    /** Status value - supports 'active', 'inactive', 'new', 'on', 'off', 'online', 'offline' and custom strings */
    status: 'active' | 'inactive' | 'new' | 'on' | 'off' | 'online' | 'offline' | string;
    /** Size variant - affects padding, text size, and icon size */
    size?: 'sm' | 'md' | 'lg';
    /** Whether to show status text alongside the dot indicator */
    showText?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Click handler - makes the badge interactive */
    onClick?: () => void;
    /** Loading state - shows pulse animation and "Updating..." text */
    loading?: boolean;
    /** Makes badge interactive with hover effects (alternative to onClick) */
    interactive?: boolean;
}

/**
 * StatusBadge - Modern status indicator component
 *
 * Features:
 * - Modern gradient backgrounds with glass effect
 * - Smooth animations and hover effects
 * - Interactive support with keyboard navigation
 * - Loading states with pulse animations
 * - Accessibility features (ARIA labels, focus management)
 * - Consistent with dashboard design system
 *
 * @param status - Status value (active, inactive, new, on, off, etc.)
 * @param size - Size variant (sm, md, lg)
 * @param showText - Whether to show text label
 * @param className - Additional CSS classes
 * @param onClick - Click handler for interactivity
 * @param loading - Loading state with pulse animation
 * @param interactive - Enable hover effects without onClick
 */
export const StatusBadge = ({
    status,
    size = 'md',
    showText = true,
    className = '',
    onClick,
    loading = false,
    interactive = false
}: StatusBadgeProps) => {
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active':
            case 'aktif':
                return {
                    icon: '●',
                    text: 'Aktif',
                    bgColor: 'bg-gradient-to-br from-green-900/20 to-green-800/10',
                    textColor: 'text-green-400',
                    borderColor: 'border-green-500/30',
                    dotColor: 'bg-green-400',
                    shadowColor: 'shadow-green-500/25'
                };
            case 'inactive':
            case 'tidak aktif':
                return {
                    icon: '●',
                    text: 'Tidak Aktif',
                    bgColor: 'bg-gradient-to-br from-red-900/20 to-red-800/10',
                    textColor: 'text-red-400',
                    borderColor: 'border-red-500/30',
                    dotColor: 'bg-red-400',
                    shadowColor: 'shadow-red-500/25'
                };
            case 'new':
                return {
                    icon: '●',
                    text: 'Member Baru',
                    bgColor: 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10',
                    textColor: 'text-yellow-400',
                    borderColor: 'border-yellow-500/30',
                    dotColor: 'bg-yellow-400',
                    shadowColor: 'shadow-yellow-500/25'
                };
            case 'on':
            case 'online':
                return {
                    icon: '●',
                    text: 'Online',
                    bgColor: 'bg-gradient-to-br from-green-900/20 to-green-800/10',
                    textColor: 'text-green-400',
                    borderColor: 'border-green-500/30',
                    dotColor: 'bg-green-400',
                    shadowColor: 'shadow-green-500/25'
                };
            case 'off':
            case 'offline':
                return {
                    icon: '●',
                    text: 'Offline',
                    bgColor: 'bg-gradient-to-br from-gray-800/20 to-gray-900/10',
                    textColor: 'text-gray-400',
                    borderColor: 'border-gray-500/30',
                    dotColor: 'bg-gray-400',
                    shadowColor: 'shadow-gray-500/25'
                };
            default:
                return {
                    icon: '●',
                    text: 'Unknown',
                    bgColor: 'bg-gradient-to-br from-gray-800/20 to-gray-900/10',
                    textColor: 'text-gray-400',
                    borderColor: 'border-gray-500/30',
                    dotColor: 'bg-gray-400',
                    shadowColor: 'shadow-gray-500/25'
                };
        }
    };

    const getSizeClasses = (size: string) => {
        switch (size) {
            case 'sm':
                return {
                    container: 'px-2 py-1 text-xs',
                    icon: 'text-sm',
                    text: 'text-xs'
                };
            case 'lg':
                return {
                    container: 'px-4 py-2 text-base',
                    icon: 'text-xl',
                    text: 'text-base'
                };
            default: // md
                return {
                    container: 'px-3 py-1.5 text-sm',
                    icon: 'text-base',
                    text: 'text-sm'
                };
        }
    };

    const config = getStatusConfig(status);
    const sizeClasses = getSizeClasses(size);
    const isClickable = onClick || interactive;

    // Handle keyboard events for accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.();
        }
    };

    const baseClasses = `
        inline-flex items-center space-x-2 rounded-xl border backdrop-blur-sm
        transition-all duration-300 ease-out will-change-transform
        ${config.bgColor} ${config.textColor} ${config.borderColor} ${config.shadowColor}
        ${sizeClasses.container}
        ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/50' : ''}
        ${loading ? 'animate-pulse' : ''}
        ${className}
    `;

    if (!showText) {
        return (
            <span
                className={`inline-flex items-center justify-center rounded-full ${sizeClasses.icon} ${className} ${isClickable ? 'cursor-pointer' : ''}`}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                tabIndex={isClickable ? 0 : undefined}
                role={isClickable ? 'button' : 'status'}
                aria-label={`Status: ${config.text}`}
            >
                <span className={`w-2 h-2 rounded-full ${config.dotColor} ${loading ? 'animate-pulse' : ''}`}></span>
            </span>
        );
    }

    return (
        <span
            className={`${baseClasses} relative overflow-hidden`}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            tabIndex={isClickable ? 0 : undefined}
            role={isClickable ? 'button' : 'status'}
            aria-label={`Status: ${config.text}`}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 rounded-xl opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12"></div>
            </div>

            {/* Status Dot */}
            <span className="relative flex items-center">
                <span className={`w-2 h-2 rounded-full ${config.dotColor} ${loading ? 'animate-pulse' : ''}`}></span>
            </span>

            {/* Status Text */}
            <span className={`font-medium ${sizeClasses.text} relative`}>
                {loading ? 'Updating...' : config.text}
            </span>

            {/* Hover Effect */}
            {isClickable && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            )}
        </span>
    );
};

export default StatusBadge;
