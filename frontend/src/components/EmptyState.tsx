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
        <div className={`flex flex-col items-center justify-center p-8 text-center rounded-[var(--r-panel)] bg-raised border border-dashed border-line ${className}`}>
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-[7px] bg-accent/10 border border-accent/20">
                {Icon && <Icon className="w-6 h-6 text-accent" />}
            </div>
            <h3 className="text-base font-bold text-text mb-1">
                {title}
            </h3>
            <p className="text-xs text-faint max-w-sm mb-5">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-black bg-accent rounded-[5px] hover:opacity-90 transition-opacity"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
