import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Calendar, TrendingUp, Download, Upload, Activity } from 'lucide-react';
import { useSystemHistory } from '../hooks/useAnalytics';

interface HistoryPoint {
    date: string;
    sent: number;
    recv: number;
}

const YearlyStatsView = () => {
    const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');

    const { data: rawData = [], isLoading: loading } = useSystemHistory({ period }) as {
        data: HistoryPoint[];
        isLoading: boolean;
    };

    const data = useMemo(() => {
        return [...rawData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [rawData]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (period === 'daily') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (period === 'monthly') return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
        if (period === 'yearly') return date.getFullYear().toString();
        return dateStr;
    };

    const totalRecv = data.reduce((acc, curr) => acc + curr.recv, 0);
    const totalSent = data.reduce((acc, curr) => acc + curr.sent, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-foreground font-bold tracking-tight">Long-term Analytics</h3>
                        <p className="text-muted-foreground text-xs">Historical network trends and growth</p>
                    </div>
                </div>

                <div className="flex bg-muted p-1 rounded-xl border border-border">
                    {(['daily', 'monthly', 'yearly'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                        >
                            <span className="capitalize">{p}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Mini Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                        <Download className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Download</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">{formatBytes(totalRecv)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">For selected period</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                        <Upload className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Upload</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">{formatBytes(totalSent)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">For selected period</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-cyan-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Traffic</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">{formatBytes(totalRecv + totalSent)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">For selected period</div>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden group shadow-sm">
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-foreground tracking-widest uppercase">Usage Timeline</span>
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest animate-pulse">
                            Refreshing...
                        </div>
                    )}
                </div>

                <div className="h-[400px] w-full">
                    {data.length === 0 && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                            <TrendingUp className="w-12 h-12 opacity-20" />
                            <p className="text-sm">No historical data found for this period</p>
                            <p className="text-xs">Analytics generation might take up to 24 hours</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRecv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="currentColor"
                                    className="text-muted-foreground"
                                    fontSize={10}
                                    tickFormatter={formatDate}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="currentColor"
                                    className="text-muted-foreground"
                                    fontSize={10}
                                    tickFormatter={formatBytes}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        color: 'hsl(var(--foreground))'
                                    }}
                                    itemStyle={{ padding: '2px 0' }}
                                    labelFormatter={(l) => new Date(l).toDateString()}
                                    formatter={(v: number) => [formatBytes(v), '']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="recv"
                                    name="Download"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRecv)"
                                    animationDuration={1500}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sent"
                                    name="Upload"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorSent)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default YearlyStatsView;
