import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Activity, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';
import { TopDevicesWidget } from './components/TopDevicesWidget';
import { ActiveConnectionsWidget } from './components/ActiveConnectionsWidget';
import { CommandPalette } from './components/CommandPalette';
import { DevicesPage } from './components/DevicesPage';
import { NetworkMap } from './components/NetworkMap';
import { SecurityAlertsWidget } from './components/SecurityAlertsWidget';
import { ConnectionGlobe } from './components/ConnectionGlobe';
import DockerManager from './components/DockerManager';
import { UserManagement } from './components/UserManagement';

import AnalyticsDashboard from './components/AnalyticsDashboard';
import SpeedtestPage from './components/SpeedtestPage';
import SettingsPage from './components/SettingsPage';
import TopStatsRow from './components/TopStatsRow';
import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import { TopNav } from './components/TopNav';
import ServerStatusCard from './components/ServerStatusCard';
import SystemDetailOverlay from './components/SystemDetailOverlay';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0f1014] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

const Dashboard = () => {
    const { wsData, isConnected } = useWebSocket();
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [overlayType, setOverlayType] = useState<'cpu' | 'ram' | 'disk' | 'all'>('all');

    const handleDetailClick = (type: 'cpu' | 'ram' | 'disk' | 'all') => {
        setOverlayType(type);
        setOverlayOpen(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-4"
        >
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-gray-400 text-sm mt-0.5">Real-time network overview</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-2.5 py-1 rounded-full flex items-center gap-2 border ${isConnected ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </span>
                        <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>{isConnected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
            </header>

            <TopStatsRow />

            {/* Live Traffic Widget */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="col-span-2 glass-card rounded-lg p-4 h-[350px] border border-white/5 bg-black/40 backdrop-blur-xl shadow-xl overflow-hidden relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-blue-400" />
                            Live Network Traffic
                        </h3>
                        <div className="flex gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-gray-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> Download
                            </span>
                            <span className="flex items-center gap-1.5 text-gray-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Upload
                            </span>
                        </div>
                    </div>
                    {wsData.length === 0 ? (
                        <div className="absolute inset-0 top-10 flex flex-col items-center justify-center space-y-4 px-12">
                            <div className="w-full h-full max-h-[250px] bg-white/5 animate-pulse rounded-lg" />
                            <p className="text-xs text-gray-500 animate-pulse">Waiting for network telemetry...</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
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
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.1} />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toFixed(0)} KB/s`} dx={-10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Area type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDownload)" isAnimationActive={false} />
                                <Area type="monotone" dataKey="upload" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorUpload)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <ServerStatusCard onDetailClick={handleDetailClick} />
            </div>

            <SystemDetailOverlay
                isOpen={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                initialType={overlayType}
            />

            {/* Bottom Widgets Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
};

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <WebSocketProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/*" element={
                            <ProtectedRoute>
                                <AppContent />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </WebSocketProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

function AppContent() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [commandOpen, setCommandOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);



    return (
        <div className="flex min-h-screen bg-[#0f1014] text-foreground font-sans selection:bg-blue-500/30">
            <Toaster richColors position="top-right" theme="dark" />
            <CommandPalette open={commandOpen} setOpen={setCommandOpen} changeTab={setActiveTab} />

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isCollapsed={sidebarCollapsed}
                setIsCollapsed={setSidebarCollapsed}
                isMobileOpen={mobileMenuOpen}
                setIsMobileOpen={setMobileMenuOpen}
            />

            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                <TopNav
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    setCommandOpen={setCommandOpen}
                    onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                />

                {/* Main Content */}
                <main className="flex-1 w-full max-w-[1920px] mx-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-background to-background relative overflow-x-hidden mb-16 md:mb-0">
                    <div className="relative h-full">
                        {/* Dashboard - Always rendered for immediate access */}
                        <div className={`${activeTab === 'dashboard' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                            <Dashboard />
                        </div>

                        {/* Lazy Loaded Components with Keep-Alive */}
                        {activeTab === 'devices' && (
                            <div className={`${activeTab === 'devices' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <DevicesPage />
                            </div>
                        )}

                        {activeTab === 'network' && (
                            <div className={`${activeTab === 'network' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <NetworkMap />
                            </div>
                        )}

                        {activeTab === 'geo' && (
                            <div className={`${activeTab === 'geo' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <ConnectionGlobe />
                            </div>
                        )}

                        {activeTab === 'analytics' && (
                            <div className={`${activeTab === 'analytics' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <AnalyticsDashboard />
                            </div>
                        )}

                        {activeTab === 'containers' && (
                            <div className={`${activeTab === 'containers' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <DockerManager />
                            </div>
                        )}

                        {activeTab === 'speedtest' && (
                            <div className={`${activeTab === 'speedtest' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <SpeedtestPage />
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className={`${activeTab === 'users' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <UserManagement />
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className={`${activeTab === 'settings' ? 'block animate-in fade-in zoom-in-95 duration-200' : 'hidden'}`}>
                                <SettingsPage />
                            </div>
                        )}
                    </div>
                </main>
                <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
        </div>
    );
}

