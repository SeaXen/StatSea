import React from 'react';
import {
    LayoutDashboard,
    Server,
    Network,
    Globe,
    Box,
    Activity,
    Zap,
    Settings,
    ChevronLeft,
    Menu,
    LogOut,
    Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    isCollapsed,
    setIsCollapsed,
    isMobileOpen,
    setIsMobileOpen
}) => {
    const { user } = useAuth();

    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'devices', label: 'Devices', icon: Server },
        { id: 'network', label: 'Map', icon: Network },
        { id: 'geo', label: 'Global', icon: Globe },
        { id: 'containers', label: 'Containers', icon: Box },
        { id: 'analytics', label: 'Analytics', icon: Activity },
        { id: 'speedtest', label: 'Speed', icon: Zap },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    // Add admin-only items
    if (user?.is_admin) {
        navItems.splice(navItems.length - 1, 0, { id: 'users', label: 'Users', icon: Users });
    }

    const sidebarVariants = {
        expanded: { width: 240 },
        collapsed: { width: 80 },
    };

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                variants={sidebarVariants}
                animate={isCollapsed ? 'collapsed' : 'expanded'}
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
                    fixed left-0 top-0 z-50 h-screen border-r border-border bg-background/80 backdrop-blur-xl
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0 transition-transform duration-300 ease-in-out md:sticky
                `}
            >
                {/* Logo Area */}
                <div className={`flex h-16 items-center ${isCollapsed ? 'justify-center' : 'justify-between px-6'} border-b border-border`}>
                    <div className="flex items-center gap-3 overflow-hidden" onClick={() => setActiveTab('dashboard')}>
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
                            <Activity className="h-5 w-5 text-blue-400" />
                            <div className="absolute inset-0 animate-pulse rounded-xl bg-blue-500/20 ring-1 ring-inset ring-blue-500/40" />
                        </div>

                        {!isCollapsed && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col"
                            >
                                <span className="font-bold tracking-tight text-foreground text-lg">Statsea</span>
                                <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Enterprise</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Collapse Toggle (Desktop only) */}
                    {!isCollapsed && (
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Navigation Items */}
                <div className="flex flex-col gap-1.5 p-3 mt-4 h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    if (window.innerWidth < 768) setIsMobileOpen(false);
                                }}
                                className={`
                                    group relative flex h-10 items-center rounded-lg transition-all duration-200
                                    ${isCollapsed ? 'justify-center px-0' : 'px-4'}
                                    ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }
                                `}
                                title={isCollapsed ? item.label : undefined}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabIndicator"
                                        className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                <item.icon className={` shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} ${isCollapsed ? 'h-5 w-5' : 'h-4 w-4'}`} />

                                {!isCollapsed && (
                                    <span className="ml-3 text-sm font-medium truncate">
                                        {item.label}
                                    </span>
                                )}

                                {/* Hover tooltip for collapsed state */}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg group-hover:block group-hover:opacity-100 z-50 whitespace-nowrap border border-border">
                                        {item.label}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Bottom Actions / User */}
                <div className="absolute bottom-0 w-full p-3 border-t border-border bg-background/20 backdrop-blur-md">
                    <button
                        className={`
                            group flex w-full items-center rounded-lg transition-all duration-200
                            ${isCollapsed ? 'justify-center h-10' : 'px-3 py-2.5 bg-accent/50 hover:bg-accent'}
                        `}
                    >
                        {isCollapsed ? (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 ring-1 ring-white/10" />
                        ) : (
                            <div className="flex items-center gap-3 w-full">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 ring-1 ring-white/10" />
                                <div className="flex flex-col items-start truncate text-left">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{user?.full_name || user?.username}</span>
                                    <span className="text-[10px] text-primary capitalize">{user?.is_admin ? 'Administrator' : 'General User'}</span>
                                </div>
                                <div className="ml-auto text-muted-foreground group-hover:text-foreground">
                                    <LogOut className="h-4 w-4" />
                                </div>
                            </div>
                        )}
                    </button>

                    {/* Desktop Expand Button if collapsed */}
                    {isCollapsed && (
                        <div className="mt-2 flex justify-center md:hidden">
                            {/* Hidden on mobile, handled by overlay */}
                        </div>
                    )}

                    {isCollapsed && (
                        <button
                            onClick={() => setIsCollapsed(false)}
                            className="hidden md:flex w-full mt-2 items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </motion.aside>
        </>
    );
};
