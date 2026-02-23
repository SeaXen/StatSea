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

const formatDate = (date: string | Date, pattern: 'HH:mm' | 'HH:mm:ss' | 'MMM d, yyyy HH:mm') => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--';
    if (pattern === 'HH:mm') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (pattern === 'HH:mm:ss') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

// --- API Helpers ---
const API_BASE = '/api/system';

const fetchLiveMetrics = async (token: string) => {
    const res = await fetch(`${API_BASE}/metrics/live`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch live metrics');
    return res.json();
};

const fetchHistory = async (token: string) => {
    const res = await fetch(`${API_BASE}/metrics/history?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch metrics history');
    return res.json();
};

const fetchForecast = async (token: string) => {
    const res = await fetch(`${API_BASE}/forecast`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch forecast');
    return res.json();
};

const fetchBackups = async (token: string) => {
    const res = await fetch(`${API_BASE}/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
};

const fetchHealthChecks = async (token: string) => {
    const res = await fetch(`${API_BASE}/health`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
};

// --- Components ---

const MetricsTab = ({ token }: { token: string }) => {
    const { data: live, isLoading: loadingLive } = useQuery({
        queryKey: ['system', 'live'],
        queryFn: () => fetchLiveMetrics(token),
        refetchInterval: 5000
    });

    const { data: history, isLoading: loadingHistory } = useQuery({
        queryKey: ['system', 'history'],
        queryFn: () => fetchHistory(token),
        refetchInterval: 60000
    });

    const { data: forecast } = useQuery({
        queryKey: ['system', 'forecast'],
        queryFn: () => fetchForecast(token)
    });

    const chartData = useMemo(() => {
        if (!history) return [];
        return [...history].reverse().map((h: any) => ({
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
                    color="text-purple-400"
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
                    color="purple"
                />
                <ForecastCard
                    title="Disk Exhaustion"
                    days={forecast?.disk_days_remaining}
                    trend={forecast?.disk_trend}
                    color="emerald"
                />
            </div>

            {/* History Chart */}
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-black/20">
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
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="time" stroke="#ffffff40" fontSize={11} />
                            <YAxis stroke="#ffffff40" fontSize={11} domain={[0, 100]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000000dd', border: '1px solid #ffffff20', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Area type="monotone" dataKey="cpu" stroke="#60a5fa" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                            <Area type="monotone" dataKey="ram" stroke="#c084fc" fillOpacity={0} name="RAM %" />
                            <Area type="monotone" dataKey="disk" stroke="#34d399" fillOpacity={0} name="Disk %" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Processes */}
            <div className="glass-card p-6 rounded-xl border border-white/10 bg-black/20">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    Top Processes
                </h3>
                <div className="space-y-3">
                    {live?.top_processes?.map((p: any) => (
                        <div key={p.pid} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
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

const BackupsTab = ({ token }: { token: string }) => {
    const queryClient = useQueryClient();
    const { data: backups, isLoading } = useQuery({
        queryKey: ['system', 'backups'],
        queryFn: () => fetchBackups(token)
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_BASE}/backups`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.json();
        },
        onSuccess: () => {
            toast.success('Backup created successfully');
            queryClient.invalidateQueries({ queryKey: ['system', 'backups'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API_BASE}/backups/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.json();
        },
        onSuccess: () => {
            toast.success('Backup deleted');
            queryClient.invalidateQueries({ queryKey: ['system', 'backups'] });
        }
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

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
                {backups?.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
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
                        <div className="flex items-center gap-2 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
                            <button className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors">
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(b.id)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {backups?.length === 0 && (
                    <div className="text-center p-12 border border-dashed border-white/10 rounded-xl">
                        <Database className="w-8 h-8 text-white/20 mx-auto mb-3" />
                        <p className="text-muted-foreground">No backups found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const HealthChecksTab = ({ token }: { token: string }) => {
    const queryClient = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [newCheck, setNewCheck] = useState({ name: '', url: '', method: 'GET', interval_seconds: 300 });

    const { data: checks, isLoading } = useQuery({
        queryKey: ['system', 'health'],
        queryFn: () => fetchHealthChecks(token)
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE}/health`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            toast.success('Health check added');
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    const triggerMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API_BASE}/health/${id}/run`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.json();
        },
        onSuccess: () => {
            toast.success('Check triggered');
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${API_BASE}/health/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.json();
        },
        onSuccess: () => {
            toast.success('Check removed');
            queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
        }
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

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
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                value={newCheck.name}
                                onChange={e => setNewCheck({ ...newCheck, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">URL</label>
                            <input
                                type="text"
                                placeholder="https://..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                value={newCheck.url}
                                onChange={e => setNewCheck({ ...newCheck, url: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-white">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate(newCheck)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                        >
                            Save Monitor
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {checks?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${c.last_status === 200 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                <Globe className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-medium flex items-center gap-2">
                                    {c.name}
                                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-white/10">{c.method}</span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.url}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="hidden md:block">
                                <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Response</div>
                                <div className="text-sm font-medium flex items-center gap-1.5">
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
                                    className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white"
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
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20 md:pb-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        System Management
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Monitor host resources, backups, and external service health.</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/5 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'metrics' && <MetricsTab token={token} />}
                {activeTab === 'backups' && <BackupsTab token={token} />}
                {activeTab === 'health' && <HealthChecksTab token={token} />}
            </motion.div>
        </div>
    );
};

// --- Helpers ---
const MetricCard = ({ title, value, total, percent, icon: Icon, color, subtext }: any) => (
    <div className="glass-card p-5 rounded-xl border border-white/10 bg-black/20 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
                <h4 className="text-2xl font-bold text-white">{value}</h4>
            </div>
            <div className={`p-2.5 rounded-xl bg-white/5 ${color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
        {total && (
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Used</span>
                    <span>Total {total}</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        className={`h-full ${color.replace('text-', 'bg-')}`}
                    />
                </div>
            </div>
        )}
        {subtext && <p className="text-[10px] text-muted-foreground mt-2">{subtext}</p>}
    </div>
);

const ForecastCard = ({ title, days, trend, color }: any) => (
    <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
                {trend === 'worsening' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div>
                <p className="text-xs text-muted-foreground font-medium">{title} Forecast</p>
                <h5 className="text-lg font-bold">
                    {days ? `Exhaustion in ${days} days` : 'Trend: Stable'}
                </h5>
            </div>
        </div>
        <div className={`text-xs font-bold uppercase tracking-widest ${trend === 'worsening' ? 'text-red-400' : 'text-emerald-400'}`}>
            {trend}
        </div>
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
