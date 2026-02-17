import { useState, useEffect } from 'react';
import { Activity, LayoutDashboard, Server, Settings as SettingsIcon, Shield, Network, Search, Globe as GlobeIcon, Box } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Toaster, toast } from 'sonner';
import { motion } from 'framer-motion';
import { TopDevicesWidget } from './components/TopDevicesWidget';
import { ActiveConnectionsWidget } from './components/ActiveConnectionsWidget';
import { CommandPalette } from './components/CommandPalette';
import { DevicesPage } from './components/DevicesPage';
import { NetworkMap } from './components/NetworkMap';
import { SecurityAlertsWidget } from './components/SecurityAlertsWidget';
import { ConnectionGlobe } from './components/ConnectionGlobe';
import DockerManager from './components/DockerManager';
import NetworkHealth from './components/NetworkHealth';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Settings from './components/Settings';

// Navigation Item Component
const NavItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
            : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}
    >
        <Icon className={`h-5 w-5 ${active ? 'text-blue-400' : ''}`} />
        <span className="font-medium">{label}</span>
    </button>
);

const Dashboard = ({ wsData, loading }: { wsData: any[], setWsData: any, loading: boolean }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
    >
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                <p className="text-gray-400 mt-1">Real-time network overview</p>
            </div>
            <div className="flex items-center gap-4">
                <NetworkHealth />
                {/* 
                <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border border-green-500/20 bg-green-500/5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-green-400">Online</span>
                </div>
                */}
            </div>
        </header>

        {/* Live Traffic Widget */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2 glass-card rounded-xl p-6 h-[400px] border border-white/5 bg-black/40 backdrop-blur-xl shadow-xl overflow-hidden relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        Live Network Traffic
                    </h3>
                    <div className="flex gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div> Download
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> Upload
                        </span>
                    </div>
                </div>
                {wsData.length === 0 ? (
                    <div className="absolute inset-0 top-20 flex flex-col items-center justify-center space-y-4 px-12">
                        <div className="w-full h-full max-h-[250px] bg-white/5 animate-pulse rounded-lg" />
                        <p className="text-xs text-gray-500 animate-pulse">Waiting for network telemetry...</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={wsData}>
                            <defs>
                                <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.2} />
                            <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toFixed(0)} KB/s`} dx={-10} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                                itemStyle={{ color: '#e2e8f0' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Area type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDownload)" isAnimationActive={false} />
                            <Area type="monotone" dataKey="upload" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUpload)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Top Stats Widget */}
            <div className="glass-card rounded-xl p-6 flex flex-col border border-white/5 bg-black/40 backdrop-blur-xl shadow-xl">
                <h3 className="text-lg font-semibold mb-6 text-gray-200">Network Status</h3>
                <div className="space-y-4 flex-1">
                    {loading ? (
                        <>
                            <div className="h-16 w-full bg-white/5 animate-pulse rounded-xl" />
                            <div className="h-16 w-full bg-white/5 animate-pulse rounded-xl" />
                            <div className="h-16 w-full bg-white/5 animate-pulse rounded-xl" />
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Total Download</span>
                                <span className="text-xl font-mono text-blue-400 font-bold group-hover:text-blue-300 transition-colors shadow-blue-500/20 drop-shadow-lg">1.2 TB</span>
                            </div>
                            <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Total Upload</span>
                                <span className="text-xl font-mono text-emerald-400 font-bold group-hover:text-emerald-300 transition-colors shadow-emerald-500/20 drop-shadow-lg">230 GB</span>
                            </div>
                            <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Active Devices</span>
                                <span className="text-xl font-mono text-purple-400 font-bold group-hover:text-purple-300 transition-colors shadow-purple-500/20 drop-shadow-lg">14</span>
                            </div>
                        </>
                    )}
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => toast.error("Device Blocking Simulated")} className="p-2 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            Block Device
                        </button>
                        <button onClick={() => toast.info("Speedtest Started...")} className="p-2 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            Run Speedtest
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <TopDevicesWidget />
            </div>
            <div className="lg:col-span-1">
                <ActiveConnectionsWidget />
            </div>
            <div className="lg:col-span-1">
                <SecurityAlertsWidget />
            </div>
        </div>
    </motion.div>
);

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [wsData, setWsData] = useState<any[]>([]);
    const [commandOpen, setCommandOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['dashboard']));

    useEffect(() => {
        setVisitedTabs(prev => {
            if (prev.has(activeTab)) return prev;
            return new Set(prev).add(activeTab);
        });
    }, [activeTab]);

    useEffect(() => {
        // Simulate initial data fetch/load
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Connect to WebSocket
        const ws = new WebSocket(`ws://${window.location.hostname}:21081/api/ws/live`);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setWsData(prev => {
                    const newData = [...prev, {
                        time: new Date(data.timestamp * 1000).toLocaleTimeString(),
                        upload: data.u / 1024, // KB
                        download: data.d / 1024, // KB
                    }];
                    if (newData.length > 20) newData.shift();
                    return newData;
                });
            } catch (e) {
                console.error("Failed to parse WS message", e);
            }
        };

        ws.onopen = () => toast.success('Connected to Live Server');
        ws.onclose = () => toast.error('Disconnected from Server');

        // Connect to Events WebSocket
        const eventWs = new WebSocket(`ws://${window.location.hostname}:21081/api/ws/events`);
        eventWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'NEW_DEVICE') {
                    toast.warning(data.title, {
                        description: data.description,
                        duration: 5000,
                    });
                }
            } catch (e) {
                console.error("Failed to parse event message", e);
            }
        };

        return () => {
            ws.close();
            eventWs.close();
        };
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-blue-500/30">
            <Toaster richColors position="top-right" theme="dark" />
            <CommandPalette open={commandOpen} setOpen={setCommandOpen} changeTab={setActiveTab} />

            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 border-r border-white/5 glass-card flex-col p-4 fixed h-full left-0 top-0 z-20">
                <div className="flex items-center gap-2 mb-8 px-2 py-2">
                    <div className="relative group cursor-pointer" onClick={() => toast.info("Statsea v0.1.0-alpha")}>
                        <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                        <Activity className="h-8 w-8 text-blue-400 relative z-10" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Statsea</span>
                </div>

                <nav className="space-y-2 flex-1">
                    <NavItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <NavItem icon={Server} label="Devices" active={activeTab === 'devices'} onClick={() => setActiveTab('devices')} />
                    <NavItem icon={Network} label="Map" active={activeTab === 'network'} onClick={() => setActiveTab('network')} />
                    <NavItem icon={GlobeIcon} label="Global" active={activeTab === 'geo'} onClick={() => setActiveTab('geo')} />
                    <NavItem icon={Shield} label="Security" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />
                    <NavItem icon={Box} label="Containers" active={activeTab === 'containers'} onClick={() => setActiveTab('containers')} />
                    <NavItem icon={Activity} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
                </nav>

                <div className="mt-auto pt-4 border-t border-white/5">
                    <NavItem icon={SettingsIcon} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-white/10 bg-black/80 backdrop-blur-xl pb-safe">
                <div className="flex justify-around items-center p-2">
                    <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <LayoutDashboard className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Home</span>
                    </button>
                    <button onClick={() => setActiveTab('network')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'network' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <Network className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Map</span>
                    </button>
                    <button onClick={() => setActiveTab('analytics')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'analytics' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <Activity className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Stats</span>
                    </button>
                    <button onClick={() => setCommandOpen(true)} className={`p-3 rounded-xl flex flex-col items-center gap-1 text-gray-500`}>
                        <Search className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Search</span>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-xl flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <SettingsIcon className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Settings</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 min-h-screen pb-24 md:pb-8 bg-[#0f1014] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background">
                <header className={`flex justify-end items-center mb-0 ${activeTab === 'dashboard' ? 'hidden md:flex absolute top-8 right-8 z-10' : 'mb-8'}`}>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCommandOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Search className="w-4 h-4" />
                            <span className="mr-2">Search...</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-gray-400 opacity-100">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </button>
                    </div>
                </header>

                <div className="relative h-full">
                    {/* Dashboard - Always rendered for immediate access */}
                    <div className={`${activeTab === 'dashboard' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                        <Dashboard wsData={wsData} setWsData={setWsData} loading={loading} />
                    </div>

                    {/* Lazy Loaded Components with Keep-Alive */}
                    {(activeTab === 'devices' || visitedTabs.has('devices')) && (
                        <div className={`${activeTab === 'devices' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <DevicesPage />
                        </div>
                    )}

                    {(activeTab === 'network' || visitedTabs.has('network')) && (
                        <div className={`${activeTab === 'network' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <NetworkMap />
                        </div>
                    )}

                    {(activeTab === 'geo' || visitedTabs.has('geo')) && (
                        <div className={`${activeTab === 'geo' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <ConnectionGlobe />
                        </div>
                    )}

                    {(activeTab === 'security' || visitedTabs.has('security')) && (
                        <div className={`${activeTab === 'security' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <div className="space-y-6">
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold text-white tracking-tight">Security Center</h1>
                                    <p className="text-gray-400 mt-1">Real-time threat monitoring and alerts</p>
                                </header>
                                <SecurityAlertsWidget />
                            </div>
                        </div>
                    )}

                    {(activeTab === 'analytics' || visitedTabs.has('analytics')) && (
                        <div className={`${activeTab === 'analytics' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <AnalyticsDashboard />
                        </div>
                    )}

                    {(activeTab === 'containers' || visitedTabs.has('containers')) && (
                        <div className={`${activeTab === 'containers' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <DockerManager />
                        </div>
                    )}

                    {(activeTab === 'settings' || visitedTabs.has('settings')) && (
                        <div className={`${activeTab === 'settings' ? 'block animate-in fade-in zoom-in-95 duration-300' : 'hidden'}`}>
                            <Settings />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
