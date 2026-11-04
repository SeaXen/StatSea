import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface Option {
    value: string | number;
    label: string;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: any) => void;
    label?: string;
    className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, label, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn("flex items-center gap-3", className)} ref={containerRef}>
            {label && <span className="text-sm font-medium text-muted-foreground">{label}</span>}
            <div className="relative min-w-[140px]">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full px-3 py-1.5 rounded-[7px] flex items-center justify-between transition-colors",
                        "bg-panel border border-line-strong hover:bg-raised active:bg-raised text-xs font-mono",
                        isOpen && "border-accent"
                    )}
                >
                    <span className="text-xs font-medium text-text">{selectedOption?.label}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-text-soft transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                            className="absolute top-full left-0 right-0 mt-1 z-50 p-1 rounded-[7px] bg-panel border border-line-strong shadow-lg"
                        >
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-2.5 py-1.5 rounded-[5px] text-xs font-mono transition-colors",
                                        option.value === value
                                            ? "bg-accent/15 text-accent font-medium"
                                            : "text-text-soft hover:bg-raised hover:text-text"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
