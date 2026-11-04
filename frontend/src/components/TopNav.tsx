import React, { useState, useRef, useEffect } from 'react';
import {
    Bell,
    LogOut,
    User as UserIcon,
    ChevronDown,
    Check,
    Network,
    Shield,
    Clock,
    Sliders,
    Laptop,
    Activity,
    Layers,
    Search
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from './NotificationCenter';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface TopNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    setCommandOpen: (open: boolean) => void;
    onMenuClick?: () => void;
    timeRange?: string;
    setTimeRange?: (range: string) => void;
}

interface NetworkEnv {
    id: string;
    name: string;
    interface: string;
    subnet: string;
    devices: number;
    status: 'online' | 'standby';
}

const NETWORKS: NetworkEnv[] = [
    { id: 'homelab', name: 'Home lab', interface: 'eth0', subnet: '192.168.1.0/24', devices: 24, status: 'online' },
    { id: 'officelan', name: 'Office LAN', interface: 'eth1', subnet: '10.0.10.0/24', devices: 42, status: 'online' },
    { id: 'iotsubnet', name: 'IoT Subnet', interface: 'vlan10', subnet: '172.16.50.0/24', devices: 16, status: 'online' },
    { id: 'wireguard', name: 'Cloud WireGuard', interface: 'wg0', subnet: '10.8.0.0/24', devices: 8, status: 'standby' },
    { id: 'docker', name: 'Docker Bridge', interface: 'docker0', subnet: '172.17.0.0/16', devices: 9, status: 'online' },
];

const EXTENDED_RANGES = [
    { id: '15m', label: '15m', name: '15 Minutes', desc: 'Real-time telemetry buffer' },
    { id: '1h', label: '1h', name: '1 Hour', desc: 'Hourly snapshot' },
    { id: '6h', label: '6h', name: '6 Hours', desc: 'Shift monitor' },
    { id: '24h', label: '24h', name: '24 Hours', desc: 'Daily cycle' },
    { id: '7d', label: '7d', name: '7 Days', desc: 'Weekly trend analysis' },
    { id: '1m', label: '1m', name: '1 Month (30d)', desc: 'Monthly baseline' },
    { id: '3m', label: '3m', name: '3 Months (90d)', desc: 'Quarterly review' },
    { id: '6m', label: '6m', name: '6 Months (180d)', desc: 'Half-year telemetry' },
    { id: '1y', label: '1y', name: '1 Year', desc: 'Annual operational audit' },
    { id: 'all', label: 'All', name: 'All Time', desc: 'Full historical archive' },
];

export const TopNav: React.FC<TopNavProps> = ({
    activeTab,
    setActiveTab,
    setCommandOpen,
    timeRange = '1h',
    setTimeRange
}) => {
    const { unreadCount, isSynthetic, isConnected } = useWebSocket();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isNetworkOpen, setIsNetworkOpen] = useState(false);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState<NetworkEnv>(NETWORKS[0]);

    const networkRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (networkRef.current && !networkRef.current.contains(event.target as Node)) {
                setIsNetworkOpen(false);
            }
            if (timeRef.current && !timeRef.current.contains(event.target as Node)) {
                setIsTimeDropdownOpen(false);
            }
            if (userRef.current && !userRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsNetworkOpen(false);
                setIsTimeDropdownOpen(false);
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleSelectNetwork = (net: NetworkEnv) => {
        setSelectedNetwork(net);
        setIsNetworkOpen(false);
        toast.success(`Switched active network to ${net.name} (${net.interface})`, {
            description: `Subnet: ${net.subnet} • ${net.devices} devices online`
        });
    };

    const handleSelectTimeRange = (rangeId: string) => {
        if (setTimeRange) {
            setTimeRange(rangeId);
        }
        setIsTimeDropdownOpen(false);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="topbar relative z-40">
            {/* Brand */}
            <div
                className="brand cursor-pointer select-none"
                tabIndex={0}
                role="button"
                onClick={() => setActiveTab('dashboard')}
                aria-label="StatSea overview"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M2 9c3-4 6-4 10 0s7 4 10 0" />
                    <path d="M2 16c3-4 6-4 10 0s7 4 10 0" opacity=".5" />
                </svg>
                <span>StatSea</span>
            </div>

            {/* Active Section Breadcrumb */}
            {activeTab && (
                <div className="hidden lg:flex items-center gap-1.5 border-l border-line pl-3 py-0.5">
                    <span className="text-muted text-xs font-mono">/</span>
                    <span className="text-xs text-text-soft font-mono font-medium capitalize">
                        {activeTab}
                    </span>
                </div>
            )}

            {/* Network Interface Selector Dropdown */}
            <div className="relative" ref={networkRef}>
                <button
                    className="select flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-panel border border-line-strong rounded-[7px] text-text hover:bg-raised transition-colors focus-visible:outline-none focus-visible:border-accent"
                    type="button"
                    aria-expanded={isNetworkOpen}
                    aria-label="Choose network environment"
                    onClick={() => setIsNetworkOpen(!isNetworkOpen)}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                    <span>{selectedNetwork.name}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-150 ${isNetworkOpen ? 'rotate-180' : ''}`} />
                </button>

                {isNetworkOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 rounded-[9px] bg-panel border border-line-strong shadow-2xl p-1.5 font-mono text-xs z-50 animate-in fade-in slide-in-from-top-1">
                        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-faint uppercase tracking-wider border-b border-line mb-1 flex items-center justify-between">
                            <span>Network Environments</span>
                            <Network className="w-3 h-3 text-accent" />
                        </div>
                        <div className="space-y-0.5">
                            {NETWORKS.map((net) => {
                                const isSelected = selectedNetwork.id === net.id;
                                return (
                                    <button
                                        key={net.id}
                                        type="button"
                                        onClick={() => handleSelectNetwork(net)}
                                        className={`w-full text-left px-2.5 py-2 rounded-[6px] flex items-center justify-between transition-colors ${
                                            isSelected ? 'bg-raised text-accent border border-accent/20' : 'text-text hover:bg-raised/70'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${net.status === 'online' ? 'bg-ok' : 'bg-warn'}`} />
                                                <span className="font-medium text-xs text-text">{net.name}</span>
                                                <span className="text-[10px] text-faint">({net.interface})</span>
                                            </div>
                                            <span className="text-[10px] text-muted pl-3.5">{net.subnet} • {net.devices} devices</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Real-time Sniffer Mode */}
            {isConnected && (
                <span className={`status text-[11px] font-semibold uppercase tracking-wider hidden sm:inline-flex ${isSynthetic ? 'warn' : 'live'}`}>
                    {isSynthetic ? 'SIMULATION MODE' : 'LIVE SNIFFING'}
                </span>
            )}

            {/* Spacer & Controls */}
            <div className="spacer">
                {/* Search */}
                <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className="search cursor-pointer text-left flex items-center gap-2"
                    aria-label="Search devices, IPs, domains"
                >
                    <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="text-faint truncate text-[12px] flex-1">Search devices, IPs, domains…</span>
                    <kbd className="mono text-[10px] text-muted ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-raised border border-line">⌘K</kbd>
                </button>

                {/* Unified Timeline Horizons Dropdown */}
                <div className="relative" ref={timeRef}>
                    {(() => {
                        const activeRange = EXTENDED_RANGES.find(r => r.id === timeRange) || EXTENDED_RANGES[1];
                        return (
                            <button
                                type="button"
                                className="select flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-panel border border-line-strong rounded-[7px] text-text hover:bg-raised transition-colors focus-visible:outline-none focus-visible:border-accent"
                                onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                                aria-expanded={isTimeDropdownOpen}
                                aria-label="Select timeline range"
                                title="Timeline Range"
                            >
                                <Clock className="w-3.5 h-3.5 text-accent" />
                                <span className="font-medium text-xs text-text">{activeRange.name}</span>
                                <span className="text-[10px] text-faint font-mono">({activeRange.label})</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-150 ${isTimeDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                        );
                    })()}

                    {isTimeDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-[9px] bg-panel border border-line-strong shadow-2xl p-1.5 font-mono text-xs z-50 animate-in fade-in slide-in-from-top-1">
                            <div className="px-2.5 py-1.5 text-[10px] font-semibold text-faint uppercase tracking-wider border-b border-line mb-1 flex items-center justify-between">
                                <span>Timeline Horizons</span>
                                <Clock className="w-3 h-3 text-accent" />
                            </div>
                            <div className="space-y-0.5 max-h-72 overflow-y-auto custom-scrollbar">
                                {EXTENDED_RANGES.map((range) => {
                                    const isSelected = timeRange === range.id;
                                    return (
                                        <button
                                            key={range.id}
                                            type="button"
                                            onClick={() => handleSelectTimeRange(range.id)}
                                            className={`w-full text-left px-2.5 py-2 rounded-[6px] flex items-center justify-between transition-colors ${
                                                isSelected ? 'bg-raised text-accent border border-accent/20' : 'text-text hover:bg-raised/70'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-xs text-text">{range.name}</span>
                                                    <span className="text-[10px] text-faint">({range.label})</span>
                                                </div>
                                                <span className="text-[10px] text-muted">{range.desc}</span>
                                            </div>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Notifications */}
                <button
                    type="button"
                    onClick={() => setIsNotificationOpen(true)}
                    className="w-[30px] h-[30px] rounded-[7px] text-muted hover:text-text hover:bg-raised relative transition-colors flex items-center justify-center border border-line-strong bg-panel focus-visible:outline-none focus-visible:border-accent"
                    aria-label="Notifications"
                    title="Telemetry Notifications"
                >
                    <Bell className="w-3.5 h-3.5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
                    )}
                </button>

                {/* User Info with Interactive Ops Menu */}
                <div className="relative pl-2 border-l border-line" ref={userRef}>
                    <button
                        type="button"
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        aria-expanded={isUserMenuOpen}
                        className="flex items-center gap-2 px-1.5 py-1 rounded-[7px] hover:bg-raised transition-colors focus-visible:outline-none"
                        aria-label="Operator menu"
                    >
                        <span className="text-xs text-text-soft hidden lg:inline font-medium">
                            {user?.full_name || user?.username}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-raised border border-line flex items-center justify-center text-accent text-xs">
                            <UserIcon className="w-3.5 h-3.5" />
                        </div>
                        <ChevronDown className={`w-3 h-3 text-muted hidden sm:inline transition-transform duration-150 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* User Menu Dropdown */}
                    {isUserMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-[9px] bg-panel border border-line-strong shadow-2xl p-1.5 font-mono text-xs z-50 animate-in fade-in slide-in-from-top-1">
                            {/* Operator Header Card */}
                            <div className="p-2.5 border-b border-line mb-1 bg-raised/40 rounded-[6px]">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-raised border border-line-strong flex items-center justify-center text-accent">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-text truncate">
                                            {user?.full_name || user?.username}
                                        </div>
                                        <div className="text-[10px] text-muted truncate">@{user?.username}</div>
                                    </div>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-[4px] bg-accent/10 text-accent border border-accent/20">
                                        {user?.is_admin ? 'ADMIN' : 'OPERATOR'}
                                    </span>
                                </div>
                                <div className="mt-2 text-[10px] text-faint flex items-center justify-between border-t border-line/60 pt-1.5">
                                    <span>Session status:</span>
                                    <span className="text-ok flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                                        Active
                                    </span>
                                </div>
                            </div>

                            {/* Quick Navigation Links */}
                            <div className="space-y-0.5 py-1">
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('settings'); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-text hover:bg-raised flex items-center gap-2 transition-colors"
                                >
                                    <Sliders className="w-3.5 h-3.5 text-muted" />
                                    <span>Settings & Preferences</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('sessions'); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-text hover:bg-raised flex items-center gap-2 transition-colors"
                                >
                                    <Laptop className="w-3.5 h-3.5 text-muted" />
                                    <span>Active Sessions</span>
                                </button>
                                {user?.is_admin && (
                                    <button
                                        type="button"
                                        onClick={() => { setActiveTab('users'); setIsUserMenuOpen(false); }}
                                        className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-text hover:bg-raised flex items-center gap-2 transition-colors"
                                    >
                                        <Shield className="w-3.5 h-3.5 text-muted" />
                                        <span>User Management</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('system'); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-text hover:bg-raised flex items-center gap-2 transition-colors"
                                >
                                    <Activity className="w-3.5 h-3.5 text-muted" />
                                    <span>System Diagnostics</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setCommandOpen(true); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-text hover:bg-raised flex items-center justify-between transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-3.5 h-3.5 text-muted" />
                                        <span>Command Palette</span>
                                    </div>
                                    <kbd className="text-[10px] text-muted">⌘K</kbd>
                                </button>
                            </div>

                            {/* Divider & Sign Out */}
                            <div className="border-t border-line mt-1 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-[6px] text-danger hover:bg-danger/10 flex items-center gap-2 transition-colors font-medium"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Sign Out Session</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <NotificationCenter
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
            />
        </header>
    );
};

