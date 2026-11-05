import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { CommandPalette } from './components/CommandPalette';
import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import { TopNav } from './components/TopNav';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { useAnalyticsSummary } from './hooks/useAnalytics';

const OnboardingTour = lazy(() => import('./components/OnboardingTour').then(m => ({ default: m.OnboardingTour })));

// Lazy loaded components
const Dashboard = lazy(() => import('./components/Dashboard'));
const DevicesPage = lazy(() => import('./components/DevicesPage').then(m => ({ default: m.DevicesPage })));
const NetworkMap = lazy(() => import('./components/NetworkMap').then(m => ({ default: m.NetworkMap })));
const ConnectionGlobe = lazy(() => import('./components/ConnectionGlobe').then(m => ({ default: m.ConnectionGlobe })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const DockerManager = lazy(() => import('./components/DockerManager'));
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const SpeedtestPage = lazy(() => import('./components/SpeedtestPage'));
const BandwidthPage = lazy(() => import('./components/BandwidthPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const DeviceBandwidthPage = lazy(() => import('./components/DeviceBandwidthPage'));
const SystemManager = lazy(() => import('./components/SystemManager'));
const SessionManager = lazy(() => import('./components/SessionManager'));

// Only load devtools in development
const ReactQueryDevtools = import.meta.env.DEV
    ? lazy(() => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })))
    : () => null;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <ThemeProvider>
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
                    </ThemeProvider>
                </BrowserRouter>
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
                </Suspense>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

function AppContent() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'dashboard';

    const setActiveTab = (tab: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (tab === 'dashboard') {
                next.delete('tab');
            } else {
                next.set('tab', tab);
            }
            return next;
        });
    };

    const [commandOpen, setCommandOpen] = useState(false);
    const [timeRange, setTimeRange] = useState('1h');
    const [selectedDeviceMac, setSelectedDeviceMac] = useState<string | null>(null);
    const { user } = useAuth();
    const { isConnected, wsData } = useWebSocket();
    const { data: analyticsData } = useAnalyticsSummary();

    const tabs = [
        { id: 'dashboard', label: 'Overview' },
        { id: 'devices', label: 'Devices' },
        { id: 'network', label: 'Map' },
        { id: 'geo', label: 'Globe' },
        { id: 'containers', label: 'Containers' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'bandwidth', label: 'Bandwidth' },
        { id: 'speedtest', label: 'Speed' },
        { id: 'system', label: 'System' },
        { id: 'sessions', label: 'Sessions' },
        ...(user?.is_admin ? [{ id: 'users', label: 'Users' }] : []),
        { id: 'settings', label: 'Settings' },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-bg text-text font-sans selection:bg-accent/20">
            <Toaster richColors position="top-right" theme="dark" />
            <CommandPalette open={commandOpen} setOpen={setCommandOpen} changeTab={setActiveTab} />
            <Suspense fallback={null}>
                <OnboardingTour />
            </Suspense>

            {/* 1. StatSea Console Topbar */}
            <TopNav
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                setCommandOpen={setCommandOpen}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
            />

            {/* 2. StatSea Console Horizontal Tabs Strip */}
            <nav className="tabs" aria-label="Sections">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className="tab-btn"
                            data-active={isActive ? "true" : "false"}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => {
                                setSelectedDeviceMac(null);
                                setActiveTab(tab.id);
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {/* 3. Main Console Viewport */}
            <main id="main-content" className="page">
                <Suspense fallback={
                    <div className="flex items-center justify-center h-[300px]">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    </div>
                }>
                    <div key={activeTab}>
                        {activeTab === 'dashboard' && <Dashboard timeRange={timeRange} />}
                        {activeTab === 'devices' && (
                            <DevicesPage onDeviceHistory={(mac: string) => {
                                setSelectedDeviceMac(mac);
                                setActiveTab('deviceBandwidth');
                            }} />
                        )}
                        {activeTab === 'network' && <NetworkMap />}
                        {activeTab === 'geo' && <ConnectionGlobe />}
                        {activeTab === 'analytics' && <AnalyticsDashboard />}
                        {activeTab === 'containers' && <DockerManager />}
                        {activeTab === 'system' && <SystemManager />}
                        {activeTab === 'speedtest' && <SpeedtestPage />}
                        {activeTab === 'bandwidth' && <BandwidthPage />}
                        {activeTab === 'deviceBandwidth' && (
                            <DeviceBandwidthPage
                                macAddress={selectedDeviceMac}
                                onBack={() => setActiveTab('devices')}
                            />
                        )}
                        {activeTab === 'users' && <UserManagement />}
                        {activeTab === 'sessions' && <SessionManager />}
                        {activeTab === 'settings' && <SettingsPage />}
                    </div>
                </Suspense>
            </main>

            {/* 4. StatSea Console Statusbar Footer */}
            <footer className="statusbar">
                <span className="status">{isConnected ? 'Capturing network traffic' : 'Telemetry offline'}</span>
                <span className="num">
                    {analyticsData?.total_packets != null
                        ? `${analyticsData.total_packets.toLocaleString()} packets`
                        : wsData && wsData.length > 0
                            ? `${wsData.length.toLocaleString()} interval frames`
                            : '0 packets'}
                </span>
                <span className="muted">
                    {isConnected ? 'WebSocket connected' : 'Connecting…'}
                </span>
                <span className="end faint">StatSea v1.0</span>
            </footer>
        </div>
    );
}
