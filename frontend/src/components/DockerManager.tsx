import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Activity,
    Clock,
    ArrowLeft,
    RotateCw,
    Terminal,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import {
    useContainers,
    useContainerLogs,
    useContainerHistory,
    useContainerUsage,
    useContainerAction,
    useDockerPrune
} from '../hooks/useDocker';

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
    update_available?: boolean;
    remote_digest?: string;
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
    if (!status) return 'text-muted-foreground bg-secondary/50 border-border';
    switch (status.toLowerCase()) {
        case 'running': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        case 'exited': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
        case 'restarting': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        default: return 'text-muted-foreground bg-secondary/50 border-border';
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
    const safeContainers = Array.isArray(containers) ? containers : [];

    const filteredContainers = useMemo(() => {
        return safeContainers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.image.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [safeContainers, searchQuery]);

    return (
        <section className="panel" aria-labelledby="ct-full">
            <div className="panel-head">
                <div className="flex items-center gap-2">
                    <h2 id="ct-full">Containers</h2>
                    <span className="meta">{filteredContainers.length} containers running</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onPrune}
                        className="px-2.5 py-1 bg-panel hover:bg-raised text-danger border border-line-strong rounded-[7px] text-xs font-medium transition-colors flex items-center gap-1.5"
                        title="Prune stopped containers"
                    >
                        <Trash2 className="w-3 h-3" />
                        <span>Prune</span>
                    </button>
                    <div className="search">
                        <span aria-hidden="true">&#8981;</span>
                        <input
                            type="search"
                            placeholder="Search containers…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search containers"
                        />
                    </div>
                </div>
            </div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Image</th>
                            <th>CPU</th>
                            <th className="right">Memory</th>
                            <th className="right">Network</th>
                            <th>State</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredContainers.map((container) => {
                            const cpuVal = Math.round(container.cpu_pct || 0);
                            const isHot = cpuVal > 80;
                            return (
                                <tr
                                    key={container.id}
                                    onClick={() => onSelect(container.id)}
                                    className="cursor-pointer"
                                >
                                    <td className="font-medium text-text">
                                        <div className="flex items-center gap-2">
                                            <span>{container.name}</span>
                                            {container.update_available && (
                                                <span className="text-[10px] px-1 py-0.2 rounded bg-accent/15 text-accent border border-accent/30 font-medium">
                                                    Update
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="mono faint max-w-[200px] truncate">{container.image}</td>
                                    <td>
                                        <div className={`meter ${isHot ? 'hot' : ''}`}>
                                            <div className="track">
                                                <i style={{ width: `${Math.min(100, cpuVal)}%` }}></i>
                                            </div>
                                            <span className="num">{cpuVal}%</span>
                                        </div>
                                    </td>
                                    <td className="right num">{container.mem_usage || 0} MB</td>
                                    <td className="right num">{container.net_rx ? formatBytes(container.net_rx) : '0 B'}</td>
                                    <td>
                                        <span className={`status ${container.status?.toLowerCase().includes('up') ? '' : 'idle'}`}>
                                            {container.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filteredContainers.length === 0 && !loading && (
                <div className="py-16 text-center text-muted">
                    <p className="font-medium">No containers found</p>
                </div>
            )}
        </section>
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

    React.useEffect(() => {
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
                    className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">{container.name}</h2>
                        {container.update_available && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full border border-blue-400/30 font-black uppercase text-blue-400 bg-blue-400/10 tracking-widest" title="Update Available">
                                Update Available
                            </span>
                        )}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border border-current font-black uppercase ${getStatusColor(container.status)}`}>
                            {container.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {container.id?.substring(0, 12)}</p>
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
                    <div className="bg-card/60 border border-border/50 rounded-2xl p-4">
                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Node Configuration</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Image', value: container.image, icon: Box },
                                { label: 'Started', value: container.state?.StartedAt ? new Date(container.state.StartedAt).toLocaleString() : 'N/A', icon: Clock },
                                { label: 'Network Rx', value: formatBytes(container.net_rx || 0), icon: Activity },
                                { label: 'Network Tx', value: formatBytes(container.net_tx || 0), icon: Activity },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-3">
                                    <item.icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{item.label}</p>
                                        <p className="text-xs text-foreground/90 mt-0.5 break-all font-mono truncate">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Real-time Load</span>
                        </div>
                        <div className="flex justify-between items-end gap-2">
                            <div>
                                <p className="text-[9px] text-muted-foreground font-black uppercase">CPU</p>
                                <p className="text-2xl font-black text-foreground">{(container.cpu_pct || 0).toFixed(2)}%</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-muted-foreground font-black uppercase text-right">MEM</p>
                                <p className="text-2xl font-black text-foreground text-right">{container.mem_usage || 0}<span className="text-xs ml-0.5">MB</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-card border border-border rounded-2xl p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Processor Intensity</span>
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
                        <div className="bg-card border border-border rounded-2xl p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Memory Isolation</span>
                                <span className="text-xs font-mono text-cyan-400 font-bold">{container.mem_usage || 0}MB</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={memData}>
                                        <Area type="monotone" dataKey="v" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-4 h-[200px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Network Throughput (RX/TX)</span>
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
                        <div className="bg-card/60 border border-border/50 rounded-2xl p-4">
                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Historical Usage Table</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="py-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Period</th>
                                            <th className="py-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Received (RX)</th>
                                            <th className="py-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Transmitted (TX)</th>
                                            <th className="py-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {[
                                            { label: 'Today (24h)', stats: usage.daily },
                                            { label: 'Monthly', stats: usage.monthly },
                                            { label: 'Yearly', stats: usage.yearly },
                                            { label: 'All-time', stats: usage.all_time },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="py-2 text-xs font-bold text-muted-foreground">{row.label}</td>
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

                    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-[300px]">
                        <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Console Stream</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {logsLoading && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed text-muted-foreground bg-black/40 custom-scrollbar">
                            {logs && Array.isArray(logs) && logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className="mb-1 border-l border-white/5 pl-3 hover:bg-white/5 transition-colors">
                                    <span className="text-muted-foreground/50 mr-3 select-none">{String(i + 1).padStart(3, '0')}</span>
                                    {typeof log === 'string' ? log : JSON.stringify(log)}
                                </div>
                            )) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground/50 italic">
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
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // TanStack Query hooks
    const { data: containersRaw = [], isLoading: loading } = useContainers();
    const containers: DockerContainer[] = Array.isArray(containersRaw) ? containersRaw : [];

    const { data: logs = [], isLoading: logsLoading } = useContainerLogs(selectedId);

    const { data: history = [] } = useContainerHistory(selectedId) as { data: ContainerHistoryPoint[] };
    const { data: usage = null } = useContainerUsage(selectedId) as { data: ContainerUsage | null };

    const containerActionMutation = useContainerAction();
    const pruneMutation = useDockerPrune();

    const handleAction = async (containerId: string, action: string) => {
        setActionLoading(`${containerId}-${action}`);
        try {
            const result = await containerActionMutation.mutateAsync({ containerId, action });
            if (result.status === "success") {
                toast.success(`Container ${action}ed successfully`);
            } else {
                toast.error(result.message || `Failed to ${action} container`);
            }
        } catch {
            toast.error(`Error performing ${action}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handlePrune = async () => {
        if (!window.confirm("Are you sure you want to remove all stopped containers? This action cannot be undone.")) return;

        const toastId = toast.loading("Pruning stopped containers...");
        try {
            const result = await pruneMutation.mutateAsync();
            if (result.error) throw new Error(result.error);

            const deletedCount = result.ContainersDeleted?.length || 0;
            const spaceReclaimed = formatBytes(result.SpaceReclaimed || 0);

            toast.success(`Pruned ${deletedCount} containers. Reclaimed ${spaceReclaimed}`, { id: toastId });
        } catch (error) {
            console.error("Prune error:", error);
            toast.error("Failed to prune containers", { id: toastId });
        }
    };

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
