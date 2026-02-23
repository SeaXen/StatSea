import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { CommandPalette } from './components/CommandPalette';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import { OnboardingTour } from './components/OnboardingTour';

// Lazy loaded components — only downloaded when the user navigates to the page
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

import { ThemeProvider } from './context/ThemeContext';

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
    const [activeTab, setActiveTab] = useState('dashboard');
    const [commandOpen, setCommandOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedDeviceMac, setSelectedDeviceMac] = useState<string | null>(null);

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
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

                <OnboardingTour />

                {/* Main Content */}
                <main className="flex-1 w-full max-w-[1920px] mx-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-background to-background relative overflow-x-hidden mb-16 md:mb-0">
                    <div className="relative h-full">
                        <Suspense fallback={
                            <div className="flex items-center justify-center h-[200px]">
                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            </div>
                        }>
                            <div key={activeTab} className="page-enter">
                                {activeTab === 'dashboard' && <Dashboard />}
                                {activeTab === 'devices' && <DevicesPage onDeviceHistory={(mac: string) => { setSelectedDeviceMac(mac); setActiveTab('deviceBandwidth'); }} />}
                                {activeTab === 'network' && <NetworkMap />}
                                {activeTab === 'geo' && <ConnectionGlobe />}
                                {activeTab === 'analytics' && <AnalyticsDashboard />}
                                {activeTab === 'containers' && <DockerManager />}
                                {activeTab === 'system' && <SystemManager />}
                                {activeTab === 'speedtest' && <SpeedtestPage />}
                                {activeTab === 'bandwidth' && <BandwidthPage />}
                                {activeTab === 'deviceBandwidth' && <DeviceBandwidthPage macAddress={selectedDeviceMac} onBack={() => setActiveTab('devices')} />}
                                {activeTab === 'users' && <UserManagement />}
                                {activeTab === 'sessions' && <SessionManager />}
                                {activeTab === 'settings' && <SettingsPage />}
                            </div>
                        </Suspense>
                    </div>
                </main>
                <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
        </div>
    );
}

