import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Cpu,
    Database,
    RefreshCw,
    Layers,
    Container,
    RotateCcw,
    Search,
    Play,
    Square,
    Activity,
    X,
    Clock,
    Shield,
    MoreVertical
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { toast } from 'sonner';

interface ContainerHistory {
    cpu: number[];
    mem: number[];
}

interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    cpu_pct: number;
    mem_usage: number;
    net_rx: number;
    net_tx: number;
    history: ContainerHistory;
    state?: {
        Running: boolean;
        Paused: boolean;
        Restarting: boolean;
        OOMKilled: boolean;
        Dead: boolean;
        Pid: number;
        ExitCode: number;
        Error: string;
        StartedAt: string;
        FinishedAt: string;
    };
    mounts?: any[];
    ports?: any;
    env?: string[];
}

// Helper functions (Top level)
const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getStatusColor = (status: string) => {
    if (!status) return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    switch (status.toLowerCase()) {
        case 'running': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        case 'exited': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
        case 'restarting': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
};

interface InspectorProps {
    container: DockerContainer;
    logs: string[];
    logsLoading: boolean;
    actionLoading: string | null;
    onAction: (id: string, action: string) => void;
    onClose: () => void;
    onRefreshLogs: (id: string) => void;
}

const ContainerInspector = React.memo(({
    container,
    logs,
    logsLoading,
    actionLoading,
    onAction,
    onClose,
    onRefreshLogs
}: InspectorProps) => {
    if (!container) return null;

    // Safety checks for nested data
    const cpuHistory = container.history?.cpu || [];
    const memHistory = container.history?.mem || [];
    const ports = container.ports || {};
    const mounts = container.mounts || [];
    const state = container.state || {
        Running: false,
        Paused: false,
        Restarting: false,
        OOMKilled: false,
        Dead: false,
        Pid: 0,
        ExitCode: 0,
        Error: '',
        StartedAt: '',
        FinishedAt: ''
    };

    return (
        <motion.div
            key="inspector-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
        >
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative h-full w-full max-w-2xl bg-gray-950 border-l border-gray-800 shadow-2xl overflow-y-auto flex flex-col"
            >
                {/* Inspector Header */}
                <div className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl border ${getStatusColor(container.status)}`}>
                            <Container className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-white tracking-tight uppercase truncate">{container.name}</h2>
                            <p className="text-xs text-gray-500 font-mono opacity-60 truncate">ID: {container.id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onRefreshLogs(container.id)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                            title="Refresh Logs"
                        >
                            <RefreshCw className={`w-5 h-5 ${logsLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-8 flex-1">
                    {/* Action Bar */}
                    <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-2xl border border-gray-800/50">
                        <button
                            disabled={!!actionLoading}
                            onClick={() => onAction(container.id, 'start')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm uppercase transition-all disabled:opacity-50"
                        >
                            {actionLoading === `${container.id}-start` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Start
                        </button>
                        <button
                            disabled={!!actionLoading}
                            onClick={() => onAction(container.id, 'stop')}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold text-sm uppercase transition-all disabled:opacity-50"
                        >
                            {actionLoading === `${container.id}-stop` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                            Stop
                        </button>
                        <button
                            disabled={!!actionLoading}
                            onClick={() => onAction(container.id, 'restart')}
                            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all disabled:opacity-50"
                        >
                            {actionLoading === `${container.id}-restart` ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs text-blue-400 font-bold uppercase">
                                <Cpu className="w-4 h-4" /> CPU Pulse
                            </div>
                            <div className="text-3xl font-mono font-bold text-white mb-2">{container.cpu_pct.toFixed(2)}%</div>
                            <div className="h-32 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cpuHistory.map(val => ({ val }))}>
                                        <YAxis domain={[0, 100]} hide />
                                        <Area type="monotone" dataKey="val" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs text-purple-400 font-bold uppercase">
                                <Database className="w-4 h-4" /> Memory Isolation
                            </div>
                            <div className="text-3xl font-mono font-bold text-white mb-2">{container.mem_usage}MB</div>
                            <div className="h-32 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={memHistory.map(val => ({ val }))}>
                                        <YAxis domain={[0, 'auto']} hide />
                                        <Area type="monotone" dataKey="val" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Details Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Network & Status</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { label: 'Status', value: container.status, icon: Activity, color: getStatusColor(container.status).split(' ')[0] },
                                { label: 'Uptime', value: state.StartedAt ? new Date(state.StartedAt).toLocaleString() : 'Not running', icon: Clock },
                                { label: 'Exit Code', value: state.ExitCode ?? '0', icon: Shield },
                                { label: 'Image Tag', value: container.image.split(':')[1] || 'latest', icon: Container }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/40 rounded-xl border border-gray-800/30">
                                    <div className="p-2 bg-gray-950 rounded-lg">
                                        <item.icon className={`w-4 h-4 ${item.color || 'text-gray-500'}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold">{item.label}</div>
                                        <div className="text-xs font-mono text-white mt-0.5 truncate">{item.value.toString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Network Transmissions */}
                    <div className="p-4 bg-gray-900/40 rounded-2xl border border-gray-800/50">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Network Transmissions</h3>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg"><RotateCcw className="w-4 h-4 text-emerald-400 rotate-180" /></div>
                                <div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Received</div>
                                    <div className="text-lg font-mono font-bold text-white">{formatBytes(container.net_rx)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg"><RotateCcw className="w-4 h-4 text-blue-400" /></div>
                                <div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Sent</div>
                                    <div className="text-lg font-mono font-bold text-white">{formatBytes(container.net_tx)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="flex flex-col h-[400px] bg-black rounded-2xl border border-gray-800 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live Logs</span>
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed space-y-1">
                            {logs && logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className="text-gray-400 break-all border-l border-gray-800 pl-3">
                                    <span className="text-gray-700 mr-2">[{i + 1}]</span>
                                    {log}
                                </div>
                            )) : (
                                <div className="h-full flex items-center justify-center text-gray-600 italic">
                                    {logsLoading ? 'Streaming logs...' : 'No logs available'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Network Mapping & Mounts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-900/40 rounded-2xl border border-gray-800/50">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Port Mappings</h3>
                            <div className="space-y-2">
                                {Object.keys(ports || {}).length > 0 ? (
                                    Object.entries(ports).map(([p, b]: any) => (
                                        <div key={p} className="flex items-center justify-between text-xs bg-black/30 p-2 rounded-lg border border-gray-800/30">
                                            <span className="text-blue-400 font-mono">{p}</span>
                                            <span className="text-emerald-400 font-mono">
                                                {Array.isArray(b) ? b.map((x: any) => `${x.HostIp}:${x.HostPort}`).join(', ') : 'Direct'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-gray-600 italic">No ports exposed</div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-gray-900/40 rounded-2xl border border-gray-800/50">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Mount Storage</h3>
                            <div className="space-y-2">
                                {mounts && mounts.length > 0 ? (
                                    mounts.map((m: any, i: number) => (
                                        <div key={i} className="text-[10px] bg-black/30 p-2 rounded-lg border border-gray-800/30">
                                            <div className="text-gray-500 uppercase mb-1">{m.Type || 'Mount'}</div>
                                            <div className="text-white font-mono break-all">{m.Source || m.Name || 'Unknown'}</div>
                                            <div className="text-blue-400 font-mono mt-1">→ {m.Destination}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-gray-600 italic">No volumes mounted</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
});

const DockerManager: React.FC = () => {
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchContainers = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:21081/api/docker/containers');
            const data = await response.json();
            setContainers(data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error("Error fetching containers:", error);
        }
    }, []);

    const fetchLogs = useCallback(async (containerId: string) => {
        if (!containerId) return;
        setLogsLoading(true);
        try {
            const response = await fetch(`http://localhost:21081/api/docker/containers/${containerId}/logs?tail=100`);
            const data = await response.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    const handleAction = useCallback(async (containerId: string, action: string) => {
        setActionLoading(`${containerId}-${action}`);
        try {
            const response = await fetch(`http://localhost:21081/api/docker/containers/${containerId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await response.json();
            if (data.status === "success") {
                toast.success(`Container ${action}ed successfully`);
                fetchContainers();
            } else {
                toast.error(data.message || `Failed to ${action} container`);
            }
        } catch (error) {
            toast.error(`Error performing ${action}`);
        } finally {
            setActionLoading(null);
        }
    }, [fetchContainers]);

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 3000);
        return () => clearInterval(interval);
    }, [fetchContainers]);

    useEffect(() => {
        if (selectedContainerId) {
            fetchLogs(selectedContainerId);
            const logInterval = setInterval(() => fetchLogs(selectedContainerId), 5000);
            return () => clearInterval(logInterval);
        } else {
            setLogs([]);
        }
    }, [selectedContainerId, fetchLogs]);

    const selectedContainer = containers.find(c => c.id === selectedContainerId) || null;

    const filteredContainers = containers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Box className="w-8 h-8 text-blue-500" />
                        Docker Containers
                    </h1>
                    <p className="text-gray-400 mt-1">Real-time resource isolation and monitoring</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search containers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-gray-900/50 border border-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchContainers}
                        className="p-2 bg-gray-900/50 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider hidden lg:block">
                        Updated: {lastUpdated.toLocaleTimeString()}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode='popLayout'>
                    {filteredContainers.map((container, idx) => {
                        const isHighUsage = container.cpu_pct > 80 || container.mem_usage > 1000;
                        const isRunning = container.status.toLowerCase() === 'running';

                        return (
                            <motion.div
                                key={container.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => setSelectedContainerId(container.id)}
                                className={`
                                    bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-4 md:p-6 
                                    overflow-hidden relative group cursor-pointer hover:border-blue-500/30 transition-all
                                    ${isHighUsage ? 'ring-1 ring-rose-500/20 shadow-2xl shadow-rose-500/5' : ''}
                                `}
                            >
                                {/* Pulse Effect for high usage */}
                                {isHighUsage && (
                                    <motion.div
                                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 pointer-events-none"
                                    />
                                )}

                                <div className="flex flex-col lg:flex-row lg:items-center gap-6 relative z-10">
                                    {/* Name & Info */}
                                    <div className="flex items-start gap-4 lg:w-1/4">
                                        <div className={`
                                            p-3 rounded-xl border ${getStatusColor(container.status)} 
                                            shadow-lg shadow-black/20 relative
                                        `}>
                                            <Container className="w-6 h-6" />
                                            {isRunning && (
                                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-lg font-semibold text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                                {container.name}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-mono truncate opacity-60">IMG: {container.image.split('/').pop()}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border border-current font-bold uppercase tracking-widest ${getStatusColor(container.status)}`}>
                                                    {container.status}
                                                </span>
                                                <span className="text-[10px] text-gray-600 font-mono">ID: {container.id.substring(0, 8)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CPU Sparkline */}
                                    <div className="flex-1 min-w-[120px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Cpu className={`w-3.5 h-3.5 ${container.cpu_pct > 50 ? 'text-amber-400' : 'text-blue-400'}`} />
                                                <span>Processor</span>
                                            </div>
                                            <span className={`text-xs font-mono font-bold ${container.cpu_pct > 80 ? 'text-rose-400' : 'text-white'}`}>
                                                {container.cpu_pct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-10 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={(container.history?.cpu || []).map(val => ({ val }))}>
                                                    <defs>
                                                        <linearGradient id={`grad-cpu-${container.id}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={container.cpu_pct > 80 ? "#f43f5e" : "#3b82f6"} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={container.cpu_pct > 80 ? "#f43f5e" : "#3b82f6"} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="val"
                                                        stroke={container.cpu_pct > 80 ? "#f43f5e" : "#3b82f6"}
                                                        strokeWidth={2}
                                                        fillOpacity={1}
                                                        fill={`url(#grad-cpu-${container.id})`}
                                                        isAnimationActive={false}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Memory Sparkline */}
                                    <div className="flex-1 min-w-[120px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Database className="w-3.5 h-3.5 text-purple-400" />
                                                <span>Memory Isolation</span>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-white">{container.mem_usage} MB</span>
                                        </div>
                                        <div className="h-10 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={(container.history?.mem || []).map(val => ({ val }))}>
                                                    <defs>
                                                        <linearGradient id={`grad-mem-${container.id}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="val"
                                                        stroke="#a855f7"
                                                        strokeWidth={2}
                                                        fillOpacity={1}
                                                        fill={`url(#grad-mem-${container.id})`}
                                                        isAnimationActive={false}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="lg:w-1/4 flex items-center justify-end gap-2 pr-2">
                                        {isRunning ? (
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={(e) => { e.stopPropagation(); handleAction(container.id, 'stop'); }}
                                                disabled={!!actionLoading}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase transition-all"
                                            >
                                                {actionLoading === `${container.id}-stop` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                                                Stop
                                            </motion.button>
                                        ) : (
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={(e) => { e.stopPropagation(); handleAction(container.id, 'start'); }}
                                                disabled={!!actionLoading}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase transition-all"
                                            >
                                                {actionLoading === `${container.id}-start` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                                Start
                                            </motion.button>
                                        )}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={(e) => { e.stopPropagation(); handleAction(container.id, 'restart'); }}
                                            disabled={!!actionLoading}
                                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg transition-all"
                                            title="Restart"
                                        >
                                            {actionLoading === `${container.id}-restart` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                        </motion.button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedContainerId(container.id); }}
                                            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white transition-all border border-gray-700/50"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Inspector Slide-over */}
            <AnimatePresence>
                {selectedContainerId && selectedContainer && (
                    <ContainerInspector
                        container={selectedContainer}
                        logs={logs}
                        logsLoading={logsLoading}
                        actionLoading={actionLoading}
                        onAction={handleAction}
                        onClose={() => setSelectedContainerId(null)}
                        onRefreshLogs={fetchLogs}
                    />
                )}
            </AnimatePresence>

            {filteredContainers.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-900/20 border border-dashed border-gray-800 rounded-3xl text-gray-600">
                    <Layers className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No containers found</p>
                    <p className="text-sm">Try adjusting your search or check Docker status</p>
                </div>
            )}
        </div>
    );
};

export default DockerManager;
