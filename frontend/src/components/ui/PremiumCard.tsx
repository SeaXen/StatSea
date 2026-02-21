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
            initial={animate ? { opacity: 0, y: 20 } : undefined}
            animate={animate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
                "glass-panel rounded-3xl p-6 relative overflow-hidden",
                hover && "transition-transform duration-300 hover:translate-y-[-4px]",
                className
            )}
        >
            {/* Subtle top-left highlight */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-[-150%] left-[-150%] w-[300%] h-[300%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_50%)]" />
            </div>

            {children}
        </motion.div>
    );
};
