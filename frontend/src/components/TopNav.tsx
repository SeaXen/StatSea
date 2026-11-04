import React, { useState } from 'react';
import {
    Bell,
    LogOut,
    User as UserIcon
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from './NotificationCenter';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface TopNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    setCommandOpen: (open: boolean) => void;
    onMenuClick?: () => void;
    timeRange?: string;
    setTimeRange?: (range: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ activeTab, setCommandOpen, timeRange = '1h', setTimeRange }) => {
    const { unreadCount, isSynthetic, isConnected } = useWebSocket();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="topbar">
            {/* Brand */}
            <div className="brand cursor-pointer" tabIndex={0} role="button" aria-label="StatSea overview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M2 9c3-4 6-4 10 0s7 4 10 0" />
                    <path d="M2 16c3-4 6-4 10 0s7 4 10 0" opacity=".5" />
                </svg>
                <span>StatSea</span>
            </div>

            {/* Active Section Label */}
            {activeTab && (
                <span className="text-xs text-muted font-mono capitalize hidden lg:inline border-l border-line pl-3 py-1">
                    {activeTab}
                </span>
            )}

            {/* Network Interface Selector */}
            <button className="select" type="button" aria-label="Choose network">
                <span>Home lab</span>
                <span aria-hidden="true">&#9662;</span>
            </button>

            {/* Real-time Sniffer Mode */}
            {isConnected && (
                <span className={`status text-[11px] font-semibold uppercase tracking-wider hidden sm:inline-flex ${isSynthetic ? 'warn' : 'live'}`}>
                    {isSynthetic ? 'SIMULATION MODE' : 'LIVE SNIFFING'}
                </span>
            )}

            {/* Spacer */}
            <div className="spacer">
                {/* Search */}
                <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="search cursor-pointer text-left"
                    aria-label="Search devices, IPs, domains"
                >
                    <span aria-hidden="true">&#8981;</span>
                    <span className="text-faint truncate text-[12px] flex-1">Search devices, IPs, domains…</span>
                    <kbd className="mono text-[10px] text-muted ml-auto hidden sm:inline-block">⌘&nbsp;K</kbd>
                </button>

                {/* Range pills */}
                <div className="range hidden md:flex" role="group" aria-label="Time range">
                    {['15m', '1h', '6h', '24h'].map(r => (
                        <button
                            key={r}
                            type="button"
                            aria-pressed={timeRange === r}
                            onClick={() => setTimeRange && setTimeRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Notifications */}
                <button
                    type="button"
                    onClick={() => setIsNotificationOpen(true)}
                    className="p-1.5 rounded-[7px] text-muted hover:text-text hover:bg-raised relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Notifications"
                >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
                    )}
                </button>

                {/* User Info & Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-line">
                    <span className="text-xs text-text-soft hidden lg:inline font-medium">
                        {user?.full_name || user?.username}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-raised border border-line flex items-center justify-center text-accent text-xs">
                        <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="p-1.5 text-muted hover:text-danger hover:bg-raised rounded-[7px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                        title="Sign out"
                        aria-label="Sign out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <NotificationCenter
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
            />
        </header>
    );
};
