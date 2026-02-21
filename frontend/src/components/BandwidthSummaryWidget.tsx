import { useState, useEffect, useCallback } from 'react';
import { Activity, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface BandwidthData {
    todayRx: number;
    todayTx: number;
    todayTotal: number;
    yesterdayRx: number;
    yesterdayTx: number;
    yesterdayTotal: number;
}

export function BandwidthSummaryWidget() {
    const [data, setData] = useState<BandwidthData | null>(null);
    const [sparkline, setSparkline] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [interfaceName, setInterfaceName] = useState<string>('');

    const fetchData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);

            // 1. Get interfaces
            const ifacesRes = await axiosInstance.get(API_CONFIG.ENDPOINTS.BANDWIDTH.INTERFACES);
            const ifaces: string[] = ifacesRes.data || [];
            if (ifaces.length === 0) return;

            const primaryIface = ifaces.find(i => i !== 'lo') || ifaces[0];
            setInterfaceName(primaryIface);

            // 2. Get summary
            const summaryRes = await axiosInstance.get(API_CONFIG.ENDPOINTS.BANDWIDTH.SUMMARY);
            const summary = summaryRes.data[primaryIface];
            if (summary) {
                setData({
                    todayRx: summary.today?.rx || 0,
                    todayTx: summary.today?.tx || 0,
                    todayTotal: summary.today?.total || 0,
                    yesterdayRx: summary.yesterday?.rx || 0,
                    yesterdayTx: summary.yesterday?.tx || 0,
                    yesterdayTotal: summary.yesterday?.total || 0,
                });
            }

            // 3. Get 24h history for sparkline
            const historyRes = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.BANDWIDTH.FIVEMINUTE}?interface=${primaryIface}&hours=24`);
            setSparkline(historyRes.data || []);

        } catch (err) {
            console.error('Failed to fetch bandwidth summary:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(), 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const calculateChange = (today: number, yesterday: number) => {
        if (yesterday === 0) return today > 0 ? 100 : 0;
        return ((today - yesterday) / yesterday) * 100;
    };

    const totalChange = data ? calculateChange(data.todayTotal, data.yesterdayTotal) : 0;
    const isIncrease = totalChange >= 0;

    return (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 z-10">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Activity className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-card-foreground leading-none">Bandwidth Summary</h3>
                        <p className="text-xs text-muted-foreground mt-1">{interfaceName || 'Network'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {loading ? (
                        <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                    ) : (
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </div>
                    )}
                    <button
                        onClick={() => fetchData(true)}
                        className={`text-muted-foreground hover:text-foreground transition-colors ${refreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {loading && !data ? (
                <div className="flex-1 flex items-center justify-center min-h-[150px]">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
            ) : data ? (
                <div className="flex-1 flex flex-col justify-between z-10 bg-card">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Today's Data</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold tracking-tight">{formatBytes(data.todayTotal)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                {isIncrease ? (
                                    <ArrowUpRight className="h-3 w-3 text-red-500" />
                                ) : (
                                    <ArrowDownRight className="h-3 w-3 text-green-500" />
                                )}
                                <span className={`text-xs font-medium ${isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                                    {Math.abs(totalChange).toFixed(1)}% vs yesterday
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 pt-1 border-l border-border/50 pl-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-blue-500" /> Down
                                </span>
                                <span className="font-medium">{formatBytes(data.todayRx)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-purple-500" /> Up
                                </span>
                                <span className="font-medium">{formatBytes(data.todayTx)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 -mx-5 -mb-5 h-[80px] opacity-70">
                        {sparkline.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparkline} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorTotal)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    No data available
                </div>
            )}
        </div>
    );
}
