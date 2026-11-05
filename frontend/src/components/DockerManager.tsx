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
    Trash2,
    Search
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

const EMPTY_CONTAINERS: DockerContainer[] = [];

const ContainerList: React.FC<ContainerListProps> = ({ containers, searchQuery, setSearchQuery, onSelect, onPrune, loading }) => {
    const safeContainers = Array.isArray(containers) ? containers : EMPTY_CONTAINERS;

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
                    <div className="search flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-muted shrink-0" />
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
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`View details for container ${container.name}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelect(container.id);
                                        }
                                    }}
                                    onClick={() => onSelect(container.id)}
                                    className="cursor-pointer focus-visible:outline-none focus-visible:bg-raised"
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
            logsEndRef.current.scrollIntoView({
                behavior: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
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
                    type="button"
                    onClick={onBack}
                    aria-label="Back to containers list"
                    className="p-2 bg-raised border border-line rounded-[7px] text-text-soft hover:text-text hover:bg-line-strong transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-text tracking-tight uppercase">{container.name}</h2>
                        {container.update_available && (
                            <span className="text-[9px] px-2 py-0.5 rounded-[4px] border border-accent/30 font-mono uppercase text-accent bg-accent/10" title="Update Available">
                                Update Available
                            </span>
                        )}
                        <span className={`text-[9px] px-2 py-0.5 rounded-[4px] border border-current font-mono uppercase ${getStatusColor(container.status)}`}>
                            {container.status}
                        </span>
                    </div>
                    <p className="text-[10px] text-faint font-mono mt-0.5">ID: {container.id?.substring(0, 12)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'start')}
                        aria-label={`Start container ${container.name}`}
                        className="px-3 py-1.5 bg-ok/10 hover:bg-ok/20 text-ok border border-ok/30 rounded-[7px] text-xs font-mono font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        START
                    </button>
                    <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'stop')}
                        aria-label={`Stop container ${container.name}`}
                        className="px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-[7px] text-xs font-mono font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        STOP
                    </button>
                    <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => onAction(container.id, 'restart')}
                        aria-label={`Restart container ${container.name}`}
                        className="p-2 bg-raised hover:bg-line-strong text-text border border-line rounded-[7px] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <RotateCw className={`w-3.5 h-3.5 ${actionLoading?.includes('restart') ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 space-y-4">
                    <div className="panel p-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold mb-3">Node Configuration</h3>
                        <div className="space-y-3 font-mono">
                            {[
                                { label: 'Image', value: container.image, icon: Box },
                                { label: 'Started', value: container.state?.StartedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(container.state.StartedAt)) : 'N/A', icon: Clock },
                                { label: 'Network Rx', value: formatBytes(container.net_rx || 0), icon: Activity },
                                { label: 'Network Tx', value: formatBytes(container.net_tx || 0), icon: Activity },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-2.5 items-start">
                                    <item.icon className="w-3.5 h-3.5 text-accent mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-faint uppercase">{item.label}</p>
                                        <p className="text-xs text-text break-all truncate">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="panel p-4 bg-raised/40">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Real-time Load</span>
                        </div>
                        <div className="flex justify-between items-end gap-2 font-mono">
                            <div>
                                <p className="text-[10px] text-faint uppercase">CPU Usage</p>
                                <p className="text-xl font-semibold text-text num">{(container.cpu_pct || 0).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-faint uppercase text-right">Memory</p>
                                <p className="text-xl font-semibold text-text num text-right">{container.mem_usage || 0}<span className="text-xs ml-0.5">MB</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="panel p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Processor Intensity</span>
                                <span className="text-xs font-mono text-accent num">{(container.cpu_pct || 0).toFixed(1)}%</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cpuData}>
                                        <Area type="monotone" dataKey="v" stroke="var(--accent)" fill="var(--accent-soft)" strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="panel p-4 h-[200px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Memory Isolation</span>
                                <span className="text-xs font-mono text-upload num">{container.mem_usage || 0}MB</span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={memData}>
                                        <Area type="monotone" dataKey="v" stroke="var(--upload)" fill="rgba(79, 209, 232, 0.1)" strokeWidth={2} isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="panel p-4 h-[200px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Network Flux (RX / TX)</span>
                            <div className="flex gap-3 text-[10px] font-mono">
                                <span className="text-ok">RX</span>
                                <span className="text-upload">TX</span>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={netData}>
                                    <Area type="monotone" dataKey="rx" stroke="var(--ok)" fill="rgba(61, 214, 140, 0.1)" strokeWidth={2} isAnimationActive={false} />
                                    <Area type="monotone" dataKey="tx" stroke="var(--upload)" fill="rgba(79, 209, 232, 0.1)" strokeWidth={2} isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {usage && (
                        <div className="panel p-4">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold mb-3">Historical Usage Ledger</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead>
                                        <tr className="border-b border-line text-faint font-mono text-[10px] uppercase">
                                            <th className="py-2">Period</th>
                                            <th className="py-2">Received (RX)</th>
                                            <th className="py-2">Transmitted (TX)</th>
                                            <th className="py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {[
                                            { label: 'Today (24h)', stats: usage.daily },
                                            { label: 'Monthly', stats: usage.monthly },
                                            { label: 'Yearly', stats: usage.yearly },
                                            { label: 'All-time', stats: usage.all_time },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-raised/40 transition-colors">
                                                <td className="py-2 text-text font-medium">{row.label}</td>
                                                <td className="py-2 text-ok">{formatBytes(row.stats.rx)}</td>
                                                <td className="py-2 text-upload">{formatBytes(row.stats.tx)}</td>
                                                <td className="py-2 text-text text-right font-semibold">{formatBytes(row.stats.rx + row.stats.tx)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="panel p-0 overflow-hidden flex flex-col h-[300px]">
                        <div className="px-4 py-2.5 border-b border-line bg-raised/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-accent" />
                                <span className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Console Telemetry Stream</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {logsLoading && <RefreshCw className="w-3 h-3 text-faint animate-spin" />}
                                <div className="w-2 h-2 rounded-full bg-ok animate-pulse" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed text-faint bg-raised/70 custom-scrollbar">
                            {logs && Array.isArray(logs) && logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className="mb-1 border-l border-line pl-3 hover:bg-panel transition-colors text-text/80">
                                    <span className="text-faint/60 mr-3 select-none">{String(i + 1).padStart(3, '0')}</span>
                                    {typeof log === 'string' ? log : JSON.stringify(log)}
                                </div>
                            )) : (
                                <div className="h-full flex items-center justify-center text-faint italic">
                                    {logsLoading ? 'Synchronizing stream…' : 'Waiting for telemetry…'}
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
    const containers: DockerContainer[] = Array.isArray(containersRaw) ? containersRaw : EMPTY_CONTAINERS;

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

    const handlePrune = () => {
        toast('Prune all stopped containers?', {
            description: 'This will remove all stopped containers and reclaim unused disk space.',
            action: {
                label: 'Prune',
                onClick: async () => {
                    const toastId = toast.loading("Pruning stopped containers…");
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
                }
            }
        });
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
