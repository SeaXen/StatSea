import { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopDevicesWidget } from './TopDevicesWidget';
import { ActiveConnectionsWidget } from './ActiveConnectionsWidget';
import { SecurityAlertsWidget } from './SecurityAlertsWidget';
import { BandwidthSummaryWidget } from './BandwidthSummaryWidget';
import TopStatsRow from './TopStatsRow';
import { useWebSocket } from '../contexts/WebSocketContext';
import ServerStatusCard from './ServerStatusCard';
import SystemDetailOverlay from './SystemDetailOverlay';
import { useAgents } from '../hooks/useAgents';
import { AgentStatusCard } from './AgentStatusCard';

const Dashboard = () => {
    const { wsData, isConnected } = useWebSocket();
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [overlayType, setOverlayType] = useState<'cpu' | 'ram' | 'disk' | 'all'>('all');
    const { data: agents = [] } = useAgents();

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
                    <p className="text-muted-foreground text-sm mt-0.5">Real-time network overview</p>
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
                        <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-blue-400" />
                            Live Network Traffic
                        </h3>
                        <div className="flex gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> Download
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Upload
                            </span>
                        </div>
                    </div>
                    {wsData.length === 0 ? (
                        <div className="absolute inset-0 top-10 flex flex-col items-center justify-center space-y-4 px-12">
                            <div className="w-full h-full max-h-[250px] bg-white/5 animate-pulse rounded-lg" />
                            <p className="text-xs text-muted-foreground animate-pulse">Waiting for network telemetry...</p>
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

                {agents.map(agent => (
                    <div key={agent.id} className="col-span-1 min-h-[350px]">
                        <AgentStatusCard agent={agent} />
                    </div>
                ))}
            </div>

            <SystemDetailOverlay
                isOpen={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                initialType={overlayType}
            />

            {/* Bottom Widgets Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
                <div className="col-span-1">
                    <BandwidthSummaryWidget />
                </div>
                <div className="col-span-1">
                    <TopDevicesWidget />
                </div>
                <div className="col-span-1">
                    <ActiveConnectionsWidget />
                </div>
                <div className="col-span-1">
                    <SecurityAlertsWidget />
                </div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
