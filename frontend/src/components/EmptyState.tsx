import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center rounded-xl bg-white/5 border border-dashed border-white/10 ${className}`}>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-white/5">
                {Icon && <Icon className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
                {title}
            </h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
