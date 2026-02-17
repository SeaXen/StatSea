import React from 'react';
import {
    LayoutDashboard,
    Server,
    Network,
    Globe,
    Box,
    Activity,
    Settings as SettingsIcon,
    Search,
    Wifi,
    Zap,
    Bell
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TopNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    setCommandOpen: (open: boolean) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ activeTab, setActiveTab, setCommandOpen }) => {

    const navItems = [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'devices', label: 'Devices', icon: Server },
        { id: 'network', label: 'Map', icon: Network },
        { id: 'geo', label: 'Global', icon: Globe },
        { id: 'containers', label: 'Containers', icon: Box },
        { id: 'analytics', label: 'Analytics', icon: Activity },
        { id: 'speedtest', label: 'Speed', icon: Zap }, // Changed icon for variety
    ];

    return (
        <div className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl">
            {/* Tier 1: Context & Global Actions */}
            <div className="flex h-12 items-center justify-between px-4 lg:px-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    {/* Brand / Logo Area */}
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20">
                            <Activity className="h-4 w-4 text-blue-400" />
                            <div className="absolute inset-0 animate-pulse rounded-lg bg-blue-500/20 ring-1 ring-inset ring-blue-500/40" />
                        </div>
                        <span className="font-semibold tracking-tight text-gray-200">Statsea</span>
                        <span className="text-xs text-gray-600">/</span>
                        <span className="text-xs font-medium text-gray-400">Network Intelligence</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search Trigger */}
                    <button
                        onClick={() => setCommandOpen(true)}
                        className="group flex items-center gap-2 rounded-md border border-white/5 bg-white/5 px-2 py-1 text-xs text-gray-400 hover:border-white/10 hover:bg-white/10 hover:text-gray-200 transition-all"
                    >
                        <Search className="h-3 w-3" />
                        <span className="hidden sm:inline">Search...</span>
                        <kbd className="hidden sm:inline-flex h-4 items-center gap-1 rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px] text-gray-500">
                            ⌘K
                        </kbd>
                    </button>

                    <div className="h-4 w-px bg-white/10 mx-1" />

                    <button className="relative rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors">
                        <Bell className="h-4 w-4" />
                        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-black" />
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`rounded-full p-0.5 border ${activeTab === 'settings' ? 'border-blue-500/50' : 'border-transparent hover:border-white/10'}`}
                    >
                        <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 ring-1 ring-white/10" />
                    </button>
                </div>
            </div>

            {/* Tier 2: Module Tabs */}
            <div className="flex h-10 items-center gap-1 px-4 lg:px-6 overflow-x-auto no-scrollbar">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`relative flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors rounded-md ${isActive
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                        >
                            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
                            {item.label}

                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-x-0 -bottom-[9px] h-[1px] bg-blue-500 shadow-[0_-1px_6px_rgba(59,130,246,0.5)]"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
