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
                        "w-full px-4 py-2 rounded-xl flex items-center justify-between transition-all duration-200",
                        "bg-card border border-border hover:border-foreground/20 active:scale-[0.98]",
                        isOpen && "border-primary/50 shadow-sm"
                    )}
                >
                    <span className="text-sm font-medium text-foreground">{selectedOption?.label}</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute top-full left-0 right-0 mt-2 z-50 p-1 rounded-xl bg-card border border-border shadow-2xl"
                        >
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                        option.value === value
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
