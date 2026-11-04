import { useState, useEffect } from 'react';
import {
    ArrowLeft, Calendar, Clock, BarChart3, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatBytes } from '../lib/utils';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

interface DeviceBandwidthPageProps {
    macAddress: string | null;
    onBack: () => void;
}

interface DeviceHistoryPoint {
    time?: string;
    date?: string;
    month?: string;
    download: number;
    upload: number;
}

interface DeviceHistoryPayload {
    hourly: DeviceHistoryPoint[];
    daily: DeviceHistoryPoint[];
    monthly?: DeviceHistoryPoint[];
    five_minute?: DeviceHistoryPoint[];
    [key: string]: unknown;
}

export default function DeviceBandwidthPage({ macAddress, onBack }: DeviceBandwidthPageProps) {
    const [historyData, setHistoryData] = useState<DeviceHistoryPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!macAddress) return;

        const fetchHistory = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY_DEVICE(macAddress));
                setHistoryData(response.data);
            } catch (err) {
                console.error("Failed to fetch device history", err);
                setError("Failed to load device history.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [macAddress]);

    if (!macAddress) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
                <p>No device selected for bandwidth history.</p>
                <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Console Header */}
            <div className="panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-[7px] bg-raised border border-line hover:border-line-strong text-muted hover:text-text transition-colors"
                        title="Back to Devices"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Device Traffic History</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">TELEMETRY</span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">
                            Target MAC: <span className="text-accent font-semibold">{macAddress}</span>
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="panel h-[280px] animate-pulse" />
                    ))}
                </div>
            ) : error ? (
                <div className="panel p-6 text-center text-danger border-danger/30 font-mono text-xs">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-danger" />
                    {error}
                </div>
            ) : historyData ? (
                <div className="space-y-4">
                    {/* Hourly History Chart (Last 24h) */}
                    <div className="panel p-4">
                        <div className="panel-head">
                            <span className="title flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-accent" />
                                Hourly Traffic (Last 24h)
                            </span>
                            <span className="sub font-mono text-[11px] text-muted">24 Hour Aggregated View</span>
                        </div>
                        <div className="h-[280px] mt-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historyData.hourly}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#242933" opacity={0.6} vertical={false} />
                                    <XAxis dataKey="time" stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} fontFamily="monospace" />
                                    <YAxis stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} fontFamily="monospace" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#15181e', borderColor: '#242933', borderRadius: '7px', fontSize: '11px', fontFamily: 'monospace' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        formatter={(val: number) => formatBytes(val)}
                                    />
                                    <Bar dataKey="download" name="Download" fill="#7c8cff" radius={[3, 3, 0, 0]} maxBarSize={32} />
                                    <Bar dataKey="upload" name="Upload" fill="#4fd1e8" radius={[3, 3, 0, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Daily History Chart (Last 30 Days) */}
                    <div className="panel p-4">
                        <div className="panel-head">
                            <span className="title flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-ok" />
                                Daily Traffic (Last 30 Days)
                            </span>
                            <span className="sub font-mono text-[11px] text-muted">30 Day Trend</span>
                        </div>
                        <div className="h-[280px] mt-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyData.daily}>
                                    <defs>
                                        <linearGradient id="colorDailyDown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7c8cff" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#7c8cff" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDailyUp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4fd1e8" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#4fd1e8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#242933" opacity={0.6} vertical={false} />
                                    <XAxis dataKey="date" stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} fontFamily="monospace" />
                                    <YAxis stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} fontFamily="monospace" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#15181e', borderColor: '#242933', borderRadius: '7px', fontSize: '11px', fontFamily: 'monospace' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        formatter={(val: number) => formatBytes(val)}
                                    />
                                    <Area type="monotone" dataKey="download" name="Download" stroke="#7c8cff" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDailyDown)" />
                                    <Area type="monotone" dataKey="upload" name="Upload" stroke="#4fd1e8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDailyUp)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Monthly History */}
                        <div className="panel p-4">
                            <div className="panel-head">
                                <span className="title flex items-center gap-2">
                                    <BarChart3 className="w-3.5 h-3.5 text-warn" />
                                    Monthly Traffic (Year)
                                </span>
                                <span className="sub font-mono text-[11px] text-muted">Annual Cumulative</span>
                            </div>
                            <div className="h-[250px] mt-3">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={historyData.monthly || []} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#242933" opacity={0.6} horizontal={false} />
                                        <XAxis type="number" stroke="#525d73" fontSize={11} tickFormatter={(v) => formatBytes(v)} fontFamily="monospace" />
                                        <YAxis dataKey="month" type="category" stroke="#525d73" fontSize={11} width={70} fontFamily="monospace" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#15181e', borderColor: '#242933', borderRadius: '7px', fontSize: '11px', fontFamily: 'monospace' }}
                                            itemStyle={{ color: '#e5e7eb' }}
                                            formatter={(val: number) => formatBytes(val)}
                                        />
                                        <Bar dataKey="download" name="Download" fill="#7c8cff" stackId="a" radius={[0, 3, 3, 0]} maxBarSize={16} />
                                        <Bar dataKey="upload" name="Upload" fill="#4fd1e8" stackId="a" radius={[0, 3, 3, 0]} maxBarSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent 5-Min Bursts */}
                        <div className="panel p-4">
                            <div className="panel-head">
                                <span className="title flex items-center gap-2">
                                    <TrendingUp className="w-3.5 h-3.5 text-upload" />
                                    5-Min Bursts (Last 2h)
                                </span>
                                <span className="sub font-mono text-[11px] text-muted">High Precision Samples</span>
                            </div>
                            <div className="h-[250px] mt-3">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={(historyData.five_minute || []).slice(-24)}>
                                        <defs>
                                            <linearGradient id="colorBurst" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4fd1e8" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#4fd1e8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#242933" opacity={0.6} vertical={false} />
                                        <XAxis dataKey="time" stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} minTickGap={15} fontFamily="monospace" />
                                        <YAxis stroke="#525d73" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} fontFamily="monospace" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#15181e', borderColor: '#242933', borderRadius: '7px', fontSize: '11px', fontFamily: 'monospace' }}
                                            itemStyle={{ color: '#e5e7eb' }}
                                            formatter={(val: number) => formatBytes(val)}
                                        />
                                        <Area type="step" dataKey="download" name="Traffic" stroke="#4fd1e8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBurst)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
