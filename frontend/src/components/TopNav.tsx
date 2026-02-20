import React, { useState } from 'react';
import {
    Search,
    Bell,
    Menu,
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
}

export const TopNav: React.FC<TopNavProps> = ({ activeTab, setCommandOpen, onMenuClick }) => {

    const { unreadCount } = useWebSocket();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 lg:px-6">

                {/* Left Side: Page Title / Breadcrumbs */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
                        aria-label="Toggle menu"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div>
                        <h2 className="text-lg font-semibold text-foreground capitalize tracking-tight">
                            {activeTab}
                        </h2>
                    </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-3">
                    <ThemeToggle />

                    {/* Search Trigger */}
                    <button
                        onClick={() => setCommandOpen(true)}
                        className="group flex items-center gap-2 rounded-full border border-border bg-accent/50 px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:bg-accent hover:text-foreground transition-all"
                        aria-label="Search"
                    >
                        <Search className="h-4 w-4" />
                        <span className="hidden sm:inline">Search...</span>
                        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border bg-accent/50 px-1.5 font-mono text-[10px] text-muted-foreground">
                            ⌘K
                        </kbd>
                    </button>

                    <div className="h-6 w-px bg-border mx-2" />

                    <button
                        onClick={() => setIsNotificationOpen(true)}
                        className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black" />
                        )}
                    </button>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    <div className="flex items-center gap-3 pl-2">
                        <div className="hidden lg:flex flex-col items-end">
                            <span className="text-xs font-medium text-foreground">{user?.full_name || user?.username}</span>
                            <span className="text-[10px] text-muted-foreground">{user?.is_admin ? 'Administrator' : 'User'}</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <UserIcon className="h-4 w-4" />
                        </div>

                        <button
                            onClick={handleLogout}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                            title="Sign Out"
                            aria-label="Sign out"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <NotificationCenter
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
            />
        </div>
    );
};
