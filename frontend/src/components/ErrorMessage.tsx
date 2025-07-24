interface ErrorMessageProps {
    message: string;
    type?: 'error' | 'warning' | 'info';
    onClose?: () => void;
    className?: string;
}

export const ErrorMessage = ({ 
    message, 
    type = 'error', 
    onClose, 
    className = '' 
}: ErrorMessageProps) => {
    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'warning':
                return {
                    bgColor: 'bg-yellow-900/20',
                    borderColor: 'border-yellow-500/30',
                    textColor: 'text-yellow-400',
                    icon: '⚠️'
                };
            case 'info':
                return {
                    bgColor: 'bg-blue-900/20',
                    borderColor: 'border-blue-500/30',
                    textColor: 'text-blue-400',
                    icon: 'ℹ️'
                };
            default: // error
                return {
                    bgColor: 'bg-red-900/20',
                    borderColor: 'border-red-500/30',
                    textColor: 'text-red-400',
                    icon: '❌'
                };
        }
    };

    const config = getTypeConfig(type);

    return (
        <div className={`
            flex items-center justify-between p-4 rounded-lg border
            ${config.bgColor} ${config.borderColor} ${config.textColor}
            ${className}
        `}>
            <div className="flex items-center space-x-3">
                <span className="text-lg">{config.icon}</span>
                <span className="font-medium">{message}</span>
            </div>
            
            {onClose && (
                <button
                    onClick={onClose}
                    className={`
                        ml-4 p-1 rounded-full hover:bg-gray-700 transition-colors
                        ${config.textColor}
                    `}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default ErrorMessage;
