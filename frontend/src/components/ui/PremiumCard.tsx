import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PremiumCardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    animate?: boolean;
    delay?: number;
    onClick?: () => void;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
    children,
    className,
    hover = true,
    animate = true,
    delay = 0,
    onClick
}) => {
    return (
        <motion.div
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
            initial={animate ? { opacity: 0, y: 20 } : undefined}
            animate={animate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                "panel p-5 relative overflow-hidden transition-colors border border-line bg-panel rounded-[10px]",
                hover && "hover:border-line-strong",
                onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                className
            )}
        >
            {children}
        </motion.div>
    );
};
