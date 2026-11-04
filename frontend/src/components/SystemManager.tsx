import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Activity,
    Database,
    Globe,
    Plus,
    Trash2,
    Play,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    Calendar,
    HardDrive,
    Cpu,
    Download,
    History,
    Shield,
    Clock,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../config/axiosInstance';

const formatDate = (date: string | Date, pattern: 'HH:mm' | 'HH:mm:ss' | 'MMM d, yyyy HH:mm') => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--';
    if (pattern === 'HH:mm') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (pattern === 'HH:mm:ss') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

interface SystemHistoryEntry {
    timestamp: string;
    cpu_pct: number;
    ram_used_gb: number;
    ram_total_gb: number;
    disk_used_gb: number;
    disk_total_gb: number;
}

interface ProcessInfo {
    pid: number;
    name: string;
    cpu_percent: number;
    memory_info: { rss: number };
}

interface BackupItem {
    id: number;
    filename: string;
    is_manual?: boolean;
    size_bytes?: number;
    created_at?: string;
}

interface HealthCheckItem {
    id: number;
    name: string;
    url: string;
    method: string;
    interval_seconds: number;
    last_status?: number;
    last_checked?: string;
}

interface MetricCardProps {
    title: string;
    value: string | number;
    total?: string;
    percent?: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    subtext?: string;
}

interface ForecastCardProps {
    title: string;
    days?: number | null;
    trend?: 'worsening' | 'improving' | 'stable';
    color?: string;
}

// --- API Helpers (Authenticated via axiosInstance) ---
const fetchLiveMetrics = async () => {
    const res = await axiosInstance.get('/system/metrics/live');
    return res.data;
};

const fetchHistory = async () => {
    const res = await axiosInstance.get('/system/metrics/history?limit=50');
    return Array.isArray(res.data) ? res.data : [];
};

const fetchForecast = async () => {
    const res = await axiosInstance.get('/system/forecast');
    return res.data;
};

const fetchBackups = async () => {
    const res = await axiosInstance.get('/system/backups');
    return Array.isArray(res.data) ? res.data : [];
};

const fetchHealthChecks = async () => {
    const res = await axiosInstance.get('/system/health');
    return Array.isArray(res.data) ? res.data : [];
};

// --- Components ---

const MetricsTab = ({ token: _token }: { token: string }) => {
    const { data: live, isLoading: loadingLive } = useQuery({
        queryKey: ['system', 'live'],
        queryFn: fetchLiveMetrics,
        refetchInterval: 5000
    });

    const { data: history, isLoading: loadingHistory } = useQuery({
        queryKey: ['system', 'history'],
        queryFn: fetchHistory,
        refetchInterval: 60000
    });

    const { data: forecast } = useQuery({
        queryKey: ['system', 'forecast'],
        queryFn: fetchForecast
    });

    const chartData = useMemo(() => {
        const safeHistory = Array.isArray(history) ? history : [];
        return [...safeHistory].reverse().map((h: SystemHistoryEntry) => ({
            time: formatDate(h.timestamp, 'HH:mm'),
            cpu: h.cpu_pct,
            ram: (h.ram_used_gb / h.ram_total_gb) * 100,
            disk: (h.disk_used_gb / h.disk_total_gb) * 100
        }));
    }, [history]);

    if (loadingLive || loadingHistory) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Real-time Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="CPU Usage"
                    value={`${live?.cpu_pct}%`}
                    icon={Cpu}
                    color="text-blue-400"
                    subtext="Average across all cores"
                />
                <MetricCard
                    title="RAM Usage"
                    value={`${live?.ram_used_gb} GB`}
                    total={`${live?.ram_total_gb} GB`}
                    percent={(live?.ram_used_gb / live?.ram_total_gb) * 100}
                    icon={Activity}
                    color="text-cyan-400"
                />
                <MetricCard
                    title="Disk Usage"
                    value={`${live?.disk_used_gb} GB`}
                    total={`${live?.disk_total_gb} GB`}
                    percent={(live?.disk_used_gb / live?.disk_total_gb) * 100}
                    icon={HardDrive}
                    color="text-emerald-400"
                />
                <MetricCard
                    title="System Uptime"
                    value={formatUptime(live?.uptime_seconds)}
                    icon={Clock}
                    color="text-amber-400"
                    subtext="Since last host reboot"
                />
            </div>

            {/* Forecasting & Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ForecastCard
                    title="RAM Exhaustion"
                    days={forecast?.ram_days_remaining}
                    trend={forecast?.ram_trend}
                    color="cyan"
                />
                <ForecastCard
                    title="Disk Exhaustion"
                    days={forecast?.disk_days_remaining}
                    trend={forecast?.disk_trend}
                    color="emerald"
                />
            </div>

            {/* History Chart */}
            <div className="panel p-4 md:p-5 rounded-[var(--r-panel)] border border-line bg-panel">
                <h3 className="text-xs font-semibold mb-5 flex items-center gap-2 font-mono text-text">
                    <History className="w-4 h-4 text-accent" />
                    Resource History
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                            <XAxis dataKey="time" stroke="var(--faint)" fontSize={10} fontStyle="monospace" />
                            <YAxis stroke="var(--faint)" fontSize={10} domain={[0, 100]} fontStyle="monospace" />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)' }}
                                itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                            />
                            <Area type="monotone" dataKey="cpu" stroke="#60a5fa" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                            <Area type="monotone" dataKey="ram" stroke="#06b6d4" fillOpacity={0} name="RAM %" />
                            <Area type="monotone" dataKey="disk" stroke="#34d399" fillOpacity={0} name="Disk %" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Processes */}
            <div className="panel p-4 md:p-5 rounded-[var(--r-panel)] border border-line bg-panel">
                <h3 className="text-xs font-semibold mb-4 flex items-center gap-2 font-mono text-text">
                    <TrendingUp className="w-4 h-4 text-warn" />
                    Top Processes
                </h3>
                <div className="space-y-2.5">
                    {live?.top_processes?.map((p: ProcessInfo) => (
                        <div key={p.pid} className="flex items-center justify-between p-2.5 rounded-[7px] bg-raised border border-line hover:border-line-strong transition-colors font-mono">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-[4px] bg-accent-soft text-accent">
                                    <Activity className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-text">{p.name}</div>
                                    <div className="text-[10px] text-faint">PID: {p.pid}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-semibold text-text num">{p.cpu_percent}% CPU</div>
                                <div className="text-[10px] text-faint num">{(p.memory_info.rss / (1024 * 1024)).toFixed(1)} MB</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BackupsTab = ({ token: _token }: { token: string }) => {
    const queryClient = useQueryClient();
    const { data: backups, isLoading } = useQuery({
        queryKey: ['system', 'backups'],
        queryFn: fetchBackups
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await axiosInstance.post('/system/backups');
            return res.data;
        },
        onSuccess: () => {
            toast.success('Backup created successfully');
            queryClient.invalidateQueries({ queryKey: ['system', 'backups'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await axiosInstance.delete(`/system/backups/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Backup deleted');
            queryClient.invalidateQueries({ queryKey: ['system', 'backups'] });
        }
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

    const safeBackups = Array.isArray(backups) ? backups : [];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-text font-mono">Database Backups</h3>
                    <p className="text-xs text-faint font-mono">Automated daily and manual Snapshots of statsea.db</p>
                </div>
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-[7px] hover:opacity-90 transition-opacity font-mono text-xs font-medium disabled:opacity-50"
                >
                    {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Manual Backup
                </button>
            </div>

            <div className="space-y-2.5">
                {safeBackups.map((b: BackupItem) => (
                    <div key={b.id} className="panel flex items-center justify-between p-3.5 rounded-[var(--r-panel)] bg-panel border border-line hover:border-line-strong transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-accent-soft text-accent">
                                <Database className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-xs font-medium font-mono text-text flex items-center gap-2">
                                    {b.filename}
                                    {b.is_manual && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-soft text-accent border border-accent/20 uppercase font-mono">Manual</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-faint font-mono flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(b.created_at || '', 'MMM d, yyyy HH:mm')}</span>
                                    <span className="num">{b.size_bytes ? (b.size_bytes / (1024 * 1024)).toFixed(2) : '0.00'} MB</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                                className="p-1.5 hover:bg-raised rounded-[7px] text-faint hover:text-text border border-transparent hover:border-line transition-colors"
                                aria-label="Download backup"
                                title="Download backup"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(b.id)}
                                className="p-1.5 hover:bg-danger/10 rounded-[7px] text-faint hover:text-danger border border-transparent hover:border-danger/20 transition-colors"
                                aria-label="Delete backup"
                                title="Delete backup"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
                {backups?.length === 0 && (
                    <div className="panel text-center p-8 border border-line rounded-[var(--r-panel)] bg-panel">
                        <Database className="w-6 h-6 text-faint mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-mono text-faint">No backups found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const HealthChecksTab = ({ token: _token }: { token: string }) => {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [newCheck, setNewCheck] = useState({ name: '', url: '', method: 'GET', interval_seconds: 300 });

    const { data: checks, isLoading } = useQuery({
        queryKey: ['system', 'health'],
        queryFn: fetchHealthChecks
    });

    const createMutation = useMutation({
        mutationFn: async (data: Omit<HealthCheckItem, 'id'>) => {
            const res = await axiosInstance.post('/system/health', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Health check added');
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    const triggerMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await axiosInstance.post(`/system/health/${id}/run`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Check triggered');
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await axiosInstance.delete(`/system/health/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Check removed');
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-accent" /></div>;

    const safeChecks = Array.isArray(checks) ? checks : [];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-text font-mono">Service Monitoring</h3>
                    <p className="text-xs text-faint font-mono">Monitor uptime and response times for arbitrary URLs</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-[7px] hover:opacity-90 transition-opacity font-mono text-xs font-medium"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Monitor
                </button>
            </div>

            {showAdd && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="panel p-4 rounded-[var(--r-panel)] border border-line bg-panel mb-4"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-[10px] font-semibold text-faint uppercase font-mono mb-1 block">Name</label>
                            <input
                                type="text"
                                placeholder="Google DNS"
                                className="w-full bg-raised border border-line text-text rounded-[7px] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                                value={newCheck.name}
                                onChange={e => setNewCheck({ ...newCheck, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold text-faint uppercase font-mono mb-1 block">URL</label>
                            <input
                                type="text"
                                placeholder="https://..."
                                className="w-full bg-raised border border-line text-text rounded-[7px] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                                value={newCheck.url}
                                onChange={e => setNewCheck({ ...newCheck, url: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs font-mono text-faint hover:text-text">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate(newCheck)}
                            className="px-3 py-1.5 bg-accent text-accent-foreground rounded-[7px] hover:opacity-90 text-xs font-mono font-medium"
                        >
                            Save Monitor
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-2.5">
                {safeChecks.map((c: HealthCheckItem) => (
                    <div key={c.id} className="panel flex items-center justify-between p-3.5 rounded-[var(--r-panel)] bg-panel border border-line hover:border-line-strong transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${c.last_status === 200 ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'}`}>
                                <Globe className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="font-medium flex items-center gap-2 text-text text-xs font-mono">
                                    {c.name}
                                    <span className="text-[9px] text-faint px-1.5 py-0.2 rounded bg-raised border border-line">{c.method}</span>
                                </div>
                                <div className="text-[10px] text-faint truncate max-w-[200px] font-mono mt-0.5">{c.url}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="hidden md:block">
                                <div className="text-[10px] text-faint uppercase font-semibold font-mono mb-0.5">Response</div>
                                <div className="text-xs font-medium flex items-center gap-1 text-text font-mono num">
                                    {c.last_status === 200 ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <AlertCircle className="w-3.5 h-3.5 text-danger" />}
                                    {c.last_status || '--'}
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <div className="text-[10px] text-faint uppercase font-semibold font-mono mb-0.5">Last Checked</div>
                                <div className="text-xs font-medium text-faint font-mono">
                                    {c.last_checked ? formatDate(c.last_checked, 'HH:mm:ss') : 'Never'}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => triggerMutation.mutate(c.id)}
                                    className="p-1.5 hover:bg-raised rounded-[7px] text-faint hover:text-text border border-transparent hover:border-line transition-colors"
                                    title="Check Now"
                                >
                                    <Play className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(c.id)}
                                    className="p-1.5 hover:bg-danger/10 rounded-[7px] text-faint hover:text-danger border border-transparent hover:border-danger/20 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Export ---

export const SystemManager = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'metrics' | 'backups' | 'health'>('metrics');

    const tabs = [
        { id: 'metrics', label: 'Metrics', icon: Activity },
        { id: 'backups', label: 'Backups', icon: Database },
        { id: 'health', label: 'Health', icon: Globe },
    ];

    if (!token) return null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Shield className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">System Operations</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                HOST TELEMETRY
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">Host kernel metrics, automated snapshots, and service probes</p>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center bg-panel rounded-[7px] border border-line-strong p-0.5 font-mono text-xs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'metrics' | 'backups' | 'health')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] transition-colors",
                                activeTab === tab.id
                                    ? "bg-accent/20 text-accent font-medium"
                                    : "text-text-soft hover:text-text hover:bg-raised"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                {activeTab === 'metrics' && <MetricsTab token={token} />}
                {activeTab === 'backups' && <BackupsTab token={token} />}
                {activeTab === 'health' && <HealthChecksTab token={token} />}
            </div>
        </div>
    );
};

// --- Helpers ---
const MetricCard: React.FC<MetricCardProps> = ({ title, value, total, percent = 0, icon: Icon, color, subtext }) => (
    <div className="panel p-3 rounded-[7px] border border-line bg-panel flex flex-col justify-between hover:border-line-strong transition-colors">
        <div className="flex justify-between items-start mb-2">
            <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-faint mb-1">{title}</p>
                <div className="text-xl font-semibold text-text font-mono num">{value}</div>
            </div>
            <div className={`p-1.5 rounded-[4px] bg-raised border border-line ${color}`}>
                <Icon className="w-4 h-4" />
            </div>
        </div>
        {total && (
            <div className="space-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between text-text-soft">
                    <span>Used</span>
                    <span>Total {total}</span>
                </div>
                <div className="meter w-full">
                    <div className="track">
                        <div
                            className={`fill ${percent > 85 ? 'bg-danger' : percent > 65 ? 'bg-warn' : 'bg-ok'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        )}
        {subtext && <p className="text-[10px] font-mono text-faint mt-2">{subtext}</p>}
    </div>
);

const ForecastCard: React.FC<ForecastCardProps> = ({ title, days, trend }) => (
    <div className="panel p-3 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-[4px] bg-raised border border-line ${trend === 'worsening' ? 'text-danger' : 'text-ok'}`}>
                {trend === 'worsening' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
            <div>
                <p className="text-[10px] text-faint uppercase">{title} Forecast</p>
                <div className="text-sm font-semibold text-text num">
                    {days ? `Exhaustion in ${days} days` : 'Trend: Stable'}
                </div>
            </div>
        </div>
        <span className={cn(
            "status text-[9px] uppercase px-1.5 py-0.5",
            trend === 'worsening' ? "danger" : "ok"
        )}>
            {trend}
        </span>
    </div>
);

const formatUptime = (seconds: number | undefined) => {
    if (!seconds) return '--';
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${mins}m`;
};

export default SystemManager;
