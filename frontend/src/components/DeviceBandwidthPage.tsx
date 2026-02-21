import { useState, useEffect } from 'react';
import {
    ArrowLeft, Activity, Calendar, Clock, BarChart3, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { PremiumCard } from './ui/PremiumCard';
import { formatBytes } from '../lib/utils';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';
import { motion } from 'framer-motion';

interface DeviceBandwidthPageProps {
    macAddress: string | null;
    onBack: () => void;
}

export default function DeviceBandwidthPage({ macAddress, onBack }: DeviceBandwidthPageProps) {
    const [historyData, setHistoryData] = useState<any>(null);
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
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
                <p>No device selected for bandwidth history.</p>
                <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-4 max-w-[1600px] mx-auto space-y-6"
        >
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Device Traffic History
                    </h2>
                    <p className="text-sm text-slate-400">
                        Analyzing bandwidth usage for MAC: <span className="text-slate-200 font-mono">{macAddress}</span>
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-[300px] bg-white/5 animate-pulse rounded-xl" />
                    ))}
                </div>
            ) : error ? (
                <div className="p-8 text-center text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    {error}
                </div>
            ) : historyData ? (
                <div className="space-y-6">
                    {/* Hourly History Chart (Last 24h) */}
                    <PremiumCard className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-emerald-400" />
                                Hourly Traffic (Last 24h)
                            </h3>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historyData.hourly}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(val: number) => formatBytes(val)}
                                    />
                                    <Bar dataKey="download" name="Download" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="upload" name="Upload" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </PremiumCard>

                    {/* Daily History Chart (Last 30 Days) */}
                    <PremiumCard className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                                Daily Traffic (Last 30 Days)
                            </h3>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyData.daily}>
                                    <defs>
                                        <linearGradient id="colorDailyDown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDailyUp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(val: number) => formatBytes(val)}
                                    />
                                    <Area type="monotone" dataKey="download" name="Download" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDailyDown)" />
                                    <Area type="monotone" dataKey="upload" name="Upload" stroke="#ec4899" fillOpacity={1} fill="url(#colorDailyUp)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </PremiumCard>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monthly History */}
                        <PremiumCard className="p-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                <BarChart3 className="w-5 h-5 text-amber-400" />
                                Monthly Traffic (Year)
                            </h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={historyData.monthly} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatBytes(v)} />
                                        <YAxis dataKey="month" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                            formatter={(val: number) => formatBytes(val)}
                                        />
                                        <Bar dataKey="download" name="Download" fill="#f59e0b" stackId="a" radius={[0, 4, 4, 0]} maxBarSize={20} />
                                        <Bar dataKey="upload" name="Upload" fill="#ef4444" stackId="a" radius={[0, 4, 4, 0]} maxBarSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </PremiumCard>

                        {/* Recent 5-Min Bursts */}
                        <PremiumCard className="p-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                <TrendingUp className="w-5 h-5 text-cyan-400" />
                                5-Min Bursts (Last 2h)
                            </h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historyData.five_minute.slice(-24)}>
                                        <defs>
                                            <linearGradient id="colorBurst" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} minTickGap={15} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                            formatter={(val: number) => formatBytes(val)}
                                        />
                                        <Area type="step" dataKey="download" name="Traffic" stroke="#06b6d4" fillOpacity={1} fill="url(#colorBurst)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </PremiumCard>
                    </div>
                </div>
            ) : null}
        </motion.div>
    );
}
