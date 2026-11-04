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
        return [...safeHistory].reverse().map((h: any) => ({
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
            <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-400" />
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
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                            <XAxis dataKey="time" stroke="currentColor" className="text-muted-foreground" fontSize={11} />
                            <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={11} domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Area type="monotone" dataKey="cpu" stroke="#60a5fa" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                            <Area type="monotone" dataKey="ram" stroke="#06b6d4" fillOpacity={0} name="RAM %" />
                            <Area type="monotone" dataKey="disk" stroke="#34d399" fillOpacity={0} name="Disk %" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Processes */}
            <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    Top Processes
                </h3>
                <div className="space-y-3">
                    {live?.top_processes?.map((p: any) => (
                        <div key={p.pid} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded bg-blue-500/10 text-blue-400">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">{p.name}</div>
                                    <div className="text-xs text-muted-foreground">PID: {p.pid}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold">{p.cpu_percent}% CPU</div>
                                <div className="text-xs text-muted-foreground">{(p.memory_info.rss / (1024 * 1024)).toFixed(1)} MB</div>
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold">Database Backups</h3>
                    <p className="text-sm text-muted-foreground">Automated daily and manual Snapshots of statsea.db</p>
                </div>
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Manual Backup
                </button>
            </div>

            <div className="space-y-3">
                {safeBackups.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    {b.filename}
                                    {b.is_manual && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">Manual</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(b.created_at, 'MMM d, yyyy HH:mm')}</span>
                                    <span>{(b.size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 transition-all">
                            <button
                                className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                                aria-label="Download backup"
                                title="Download backup"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(b.id)}
                                className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:outline-none"
                                aria-label="Delete backup"
                                title="Delete backup"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {backups?.length === 0 && (
                    <div className="text-center p-12 border border-dashed border-border rounded-xl">
                        <Database className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-muted-foreground">No backups found.</p>
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
        mutationFn: async (data: any) => {
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

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

    const safeChecks = Array.isArray(checks) ? checks : [];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold">Service Monitoring</h3>
                    <p className="text-sm text-muted-foreground">Monitor uptime and response times for arbitrary URLs</p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Monitor
                </button>
            </div>

            {showAdd && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 mb-6"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Name</label>
                            <input
                                type="text"
                                placeholder="Google DNS"
                                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                value={newCheck.name}
                                onChange={e => setNewCheck({ ...newCheck, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">URL</label>
                            <input
                                type="text"
                                placeholder="https://..."
                                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                value={newCheck.url}
                                onChange={e => setNewCheck({ ...newCheck, url: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate(newCheck)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                        >
                            Save Monitor
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {safeChecks.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${c.last_status === 200 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-medium flex items-center gap-2 text-foreground">
                                    {c.name}
                                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border">{c.method}</span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.url}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="hidden md:block">
                                <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Response</div>
                                <div className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                                    {c.last_status === 200 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                    {c.last_status || '--'}
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Last Checked</div>
                                <div className="text-sm font-medium text-muted-foreground">
                                    {c.last_checked ? formatDate(c.last_checked, 'HH:mm:ss') : 'Never'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => triggerMutation.mutate(c.id)}
                                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
                                    title="Check Now"
                                >
                                    <Play className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(c.id)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
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
                            onClick={() => setActiveTab(tab.id as any)}
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
const MetricCard = ({ title, value, total, percent, icon: Icon, color, subtext }: any) => (
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

const ForecastCard = ({ title, days, trend }: any) => (
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
