import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Layers,
    Container,
    Search,
    Activity,
    Clock,
    ChevronRight,
    ArrowLeft,
    RotateCw,
    Terminal,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';

// --- Interfaces ---

interface ContainerHistory {
    cpu: number[];
    mem: number[];
}

interface ContainerHistoryPoint {
    timestamp: string;
    cpu_pct: number;
    mem_usage: number;
    net_rx: number;
    net_tx: number;
}

interface UsageStats {
    rx: number;
    tx: number;
}

interface ContainerUsage {
    daily: UsageStats;
    monthly: UsageStats;
    yearly: UsageStats;
    all_time: UsageStats;
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
    history?: ContainerHistory;
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
}

// --- Utilities ---

const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
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

// --- Sub-components (Externalized for stability) ---

interface ContainerListProps {
    containers: DockerContainer[];
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    onSelect: (id: string) => void;
    onPrune: () => void;
    loading: boolean;
}

const ContainerList: React.FC<ContainerListProps> = ({ containers, searchQuery, setSearchQuery, onSelect, onPrune, loading }) => {
    const filteredContainers = useMemo(() =>
        containers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.image.toLowerCase().includes(searchQuery.toLowerCase())
        ), [containers, searchQuery]
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Box className="w-6 h-6 text-blue-500" />
                        Docker Manager
                    </h1>
                    <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-[0.15em] font-bold">Manage system containers</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onPrune}
                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold transition-all"
                        title="Prune stopped containers"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prune</span>
                    </button>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search containers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-gray-900/50 border border-gray-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all w-full md:w-48 placeholder:text-gray-600"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {filteredContainers.map((container) => (
                    <div
                        key={container.id}
                        onClick={() => onSelect(container.id)}
                        className="group relative bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-4 cursor-pointer hover:border-blue-500/30 hover:bg-gray-900/60 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl border ${getStatusColor(container.status)} shadow-lg shrink-0`}>
                                <Container className="w-4.5 h-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-base font-bold text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                        {container.name}
                                    </h3>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border border-current font-black uppercase tracking-[0.1em] ${getStatusColor(container.status)}`}>
                                        {container.status}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono truncate opacity-60">
                                    {container.image.split('/').pop()}
                                </p>
                            </div>
                            <div className="flex items-center gap-8 shrink-0">
                                <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">CPU</span>
                                    <span className="font-mono text-xs text-blue-400 font-bold">{(container.cpu_pct || 0).toFixed(1)}%</span>
                                </div>
                                <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">MEM</span>
                                    <span className="font-mono text-xs text-purple-400 font-bold">{container.mem_usage || 0}MB</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredContainers.length === 0 && !loading && (
                <div className="py-20 text-center text-gray-600 border border-dashed border-gray-800 rounded-3xl">
                    <Layers className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="font-bold">No containers found</p>
                </div>
            )}
        </motion.div>
    );
};

interface ContainerDetailProps {
    container: DockerContainer;
    onBack: () => void;
    onAction: (id: string, action: string) => void;
    actionLoading: string | null;
    logs: string[];
    logsLoading: boolean;
}

const ContainerDetail: React.FC<ContainerDetailProps & { history: ContainerHistoryPoint[], usage: ContainerUsage | null }> = ({
    container, onBack, onAction, actionLoading, logs, logsLoading, history, usage
}) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const cpuData = useMemo(() => history.map(h => ({ v: h.cpu_pct })), [history]);
    const memData = useMemo(() => history.map(h => ({ v: h.mem_usage })), [history]);
    const netData = useMemo(() => history.map(h => ({
        rx: h.net_rx,
        tx: h.net_tx,
        timestamp: h.timestamp
    })), [history]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
        >
            <header className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-gray-700 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">{container.name}</h2>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border border-current font-black uppercase ${getStatusColor(container.status)}`}>
                            {container.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {container.id?.substring(0, 12)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'start')}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        Start
                    </button>
                    <button
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'stop')}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        Stop
                    </button>
                    <button
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'restart')}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all disabled:opacity-50"
                    >
                        <RotateCw className={`w-4 h-4 ${actionLoading?.includes('restart') ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Node Configuration</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Image', value: container.image, icon: Box },
                                { label: 'Started', value: container.state?.StartedAt ? new Date(container.state.StartedAt).toLocaleString() : 'N/A', icon: Clock },
                                { label: 'Network Rx', value: formatBytes(container.net_rx || 0), icon: Activity },
                                { label: 'Network Tx', value: formatBytes(container.net_tx || 0), icon: Activity },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-3">
                                    <item.icon className="w-4 h-4 text-gray-600 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{item.label}</p>
                                        <p className="text-xs text-gray-200 mt-0.5 break-all font-mono truncate">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time Load</span>
                        </div>
                        <div className="flex justify-between items-end gap-2">
                            <div>
                                <p className="text-[9px] text-gray-500 font-black uppercase">CPU</p>
                                <p className="text-2xl font-black text-white">{(container.cpu_pct || 0).toFixed(2)}%</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-gray-500 font-black uppercase text-right">MEM</p>
                                <p className="text-2xl font-black text-white text-right">{container.mem_usage || 0}<span className="text-xs ml-0.5">MB</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Processor Intensity</span>
                                <span className="text-xs font-mono text-blue-400 font-bold">{(container.cpu_pct || 0).toFixed(1)}%</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cpuData}>
                                        <Area type="monotone" dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Memory Isolation</span>
                                <span className="text-xs font-mono text-purple-400 font-bold">{container.mem_usage || 0}MB</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={memData}>
                                        <Area type="monotone" dataKey="v" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 h-[200px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Network Throughput (RX/TX)</span>
                            <div className="flex gap-3 text-[9px] font-bold">
                                <span className="text-blue-400">RX</span>
                                <span className="text-emerald-400">TX</span>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={netData}>
                                    <Area type="monotone" dataKey="rx" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    <Area type="monotone" dataKey="tx" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {usage && (
                        <div className="bg-gray-900/60 border border-gray-800/50 rounded-2xl p-4">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Historical Usage Table</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-800">
                                            <th className="py-2 text-[9px] font-black text-gray-500 uppercase tracking-widest">Period</th>
                                            <th className="py-2 text-[9px] font-black text-gray-500 uppercase tracking-widest">Received (RX)</th>
                                            <th className="py-2 text-[9px] font-black text-gray-500 uppercase tracking-widest">Transmitted (TX)</th>
                                            <th className="py-2 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {[
                                            { label: 'Today (24h)', stats: usage.daily },
                                            { label: 'Monthly', stats: usage.monthly },
                                            { label: 'Yearly', stats: usage.yearly },
                                            { label: 'All-time', stats: usage.all_time },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="py-2 text-xs font-bold text-gray-400">{row.label}</td>
                                                <td className="py-2 text-xs font-mono text-blue-400">{formatBytes(row.stats.rx)}</td>
                                                <td className="py-2 text-xs font-mono text-emerald-400">{formatBytes(row.stats.tx)}</td>
                                                <td className="py-2 text-xs font-mono text-white text-right font-bold">{formatBytes(row.stats.rx + row.stats.tx)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col h-[300px]">
                        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Console Stream</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {logsLoading && <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />}
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed text-gray-400 bg-black/40 custom-scrollbar">
                            {logs && Array.isArray(logs) && logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className="mb-1 border-l border-white/5 pl-3 hover:bg-white/5 transition-colors">
                                    <span className="text-gray-700 mr-3 select-none">{String(i + 1).padStart(3, '0')}</span>
                                    {typeof log === 'string' ? log : JSON.stringify(log)}
                                </div>
                            )) : (
                                <div className="h-full flex items-center justify-center text-gray-700 italic">
                                    {logsLoading ? 'Synchronizing stream...' : 'Waiting for telemetry...'}
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// --- Main DockerManager Component ---

const DockerManager: React.FC = () => {
    const [containers, setContainers] = useState<DockerContainer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [history, setHistory] = useState<ContainerHistoryPoint[]>([]);
    const [usage, setUsage] = useState<ContainerUsage | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchContainers = useCallback(async () => {
        try {
            const response = await axiosInstance.get(API_CONFIG.ENDPOINTS.DOCKER.CONTAINERS);
            setContainers(Array.isArray(response.data) ? response.data : []);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching containers:", error);
            setLoading(false);
        }
    }, []);

    const fetchLogs = useCallback(async (containerId: string) => {
        if (!containerId) return;
        setLogsLoading(true);
        try {
            const response = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DOCKER.LOGS(containerId)}?tail=100`);
            setLogs(response.data.logs || []);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async (containerId: string) => {
        try {
            const response = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DOCKER.HISTORY(containerId)}?minutes=60`);
            setHistory(response.data || []);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    }, []);

    const fetchUsage = useCallback(async (containerId: string) => {
        try {
            const response = await axiosInstance.get(API_CONFIG.ENDPOINTS.DOCKER.USAGE(containerId));
            setUsage(response.data);
        } catch (error) {
            console.error("Failed to fetch usage:", error);
        }
    }, []);

    const handleAction = useCallback(async (containerId: string, action: string) => {
        setActionLoading(`${containerId}-${action}`);
        try {
            const response = await axiosInstance.post(`${API_CONFIG.ENDPOINTS.DOCKER.CONTAINERS}/${containerId}/action`, { action });
            if (response.data.status === "success") {
                toast.success(`Container ${action}ed successfully`);
                fetchContainers();
            } else {
                toast.error(response.data.message || `Failed to ${action} container`);
            }
        } catch (error) {
            toast.error(`Error performing ${action}`);
        } finally {
            setActionLoading(null);
        }
    }, [fetchContainers]);

    const handlePrune = useCallback(async () => {
        if (!window.confirm("Are you sure you want to remove all stopped containers? This action cannot be undone.")) return;

        const toastId = toast.loading("Pruning stopped containers...");
        try {
            const response = await axiosInstance.post(API_CONFIG.ENDPOINTS.DOCKER.PRUNE);
            const result = response.data;
            if (result.error) throw new Error(result.error);

            const deletedCount = result.ContainersDeleted?.length || 0;
            const spaceReclaimed = formatBytes(result.SpaceReclaimed || 0);

            toast.success(`Pruned ${deletedCount} containers. Reclaimed ${spaceReclaimed}`, { id: toastId });
            fetchContainers();
        } catch (error) {
            console.error("Prune error:", error);
            toast.error("Failed to prune containers", { id: toastId });
        }
    }, [fetchContainers]);

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 3000);
        return () => clearInterval(interval);
    }, [fetchContainers]);

    useEffect(() => {
        if (selectedId) {
            fetchLogs(selectedId);
            fetchHistory(selectedId);
            fetchUsage(selectedId);

            const intervals = [
                setInterval(() => fetchLogs(selectedId), 5000),
                setInterval(() => fetchHistory(selectedId), 10000),
                setInterval(() => fetchUsage(selectedId), 60000)
            ];

            return () => intervals.forEach(clearInterval);
        } else {
            setLogs([]);
            setHistory([]);
            setUsage(null);
        }
    }, [selectedId, fetchLogs, fetchHistory, fetchUsage]);

    const selectedContainer = useMemo(() =>
        containers.find(c => c.id === selectedId), [containers, selectedId]
    );

    return (
        <div className="relative">
            <AnimatePresence mode="wait">
                {selectedId && selectedContainer ? (
                    <ContainerDetail
                        key="detail"
                        container={selectedContainer}
                        onBack={() => setSelectedId(null)}
                        onAction={handleAction}
                        actionLoading={actionLoading}
                        logs={logs}
                        logsLoading={logsLoading}
                        history={history}
                        usage={usage}
                    />
                ) : (
                    <ContainerList
                        key="list"
                        containers={containers}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        onSelect={setSelectedId}
                        onPrune={handlePrune}
                        loading={loading}
                    />

                )}
            </AnimatePresence>
        </div>
    );
};

export default DockerManager;
