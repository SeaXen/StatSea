import { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Activity, Wifi, Zap, Server, Globe,
    Settings, Play, Clock, TrendingUp,
    Download, Upload, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import SpeedtestService, { SpeedtestResult } from '../services/SpeedtestService';
import SpeedtestSettingsModal from './SpeedtestSettingsModal';

// ─── Design Components ───

// Stat Card (Matching AnalyticsDashboard)
const StatCard = ({ label, value, icon: Icon, color, sub, trend }: {
    label: string; value: string | number; icon: any; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden group hover:border-gray-700 transition-all duration-300 hover:shadow-lg" style={{ '--glow': color } as React.CSSProperties}>
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
        </div>
        <span className="text-2xl font-bold text-white font-mono truncate">{value}</span>
        {sub && (
            <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                {trend === 'down' && <TrendingUp className="w-3 h-3 text-red-400 rotate-180" />}
                <span className="text-[11px] text-gray-500 truncate">{sub}</span>
            </div>
        )}
        <div className="absolute bottom-0 left-0 h-[2px] w-full opacity-50" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
);

const SpeedtestPage = () => {
    // State
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [history, setHistory] = useState<SpeedtestResult[]>([]);
    const [latestResult, setLatestResult] = useState<SpeedtestResult | null>(null);
    const [provider, setProvider] = useState<'ookla' | 'cloudflare'>('ookla');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Load History
    const fetchHistory = useCallback(async () => {
        try {
            const data = await SpeedtestService.getHistory();
            setHistory(data);
            if (data.length > 0) {
                setLatestResult(data[0]);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Run Test
    const runSpeedtest = async () => {
        setLoading(true);
        setProgress(0);

        // Simulate progress for UX since backend is sync
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return 90;
                return prev + (100 / (25000 / 500)); // Approx 25s
            });
        }, 500);

        try {
            const result = await SpeedtestService.runSpeedtest(provider);
            setLatestResult(result);
            await fetchHistory();
            setProgress(100);
        } catch (error) {
            console.error('Speedtest failed:', error);
        } finally {
            clearInterval(interval);
            setLoading(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    // Derived Metrics
    const bestDownload = history.length > 0 ? Math.max(...history.map(r => r.download)) : 0;
    const avgPing = history.length > 0 ? Math.round(history.reduce((a, b) => a + b.ping, 0) / history.length) : 0;
    const totalTests = history.length;

    // Formatting helpers
    const toMbps = (bps: number) => (bps / 1_000_000).toFixed(1);

    // Chart Data Preparation
    const chartData = history.slice(0, 20).reverse().map(r => ({
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        down: parseFloat(toMbps(r.download)),
        up: parseFloat(toMbps(r.upload)),
        ping: r.ping
    }));

    return (
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Activity className="w-8 h-8 text-cyan-400" />
                        Speedtest Intelligence
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Advanced network performance analytics & automation</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 border border-gray-800 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800/60 transition-all font-medium text-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                    <button
                        onClick={runSpeedtest}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all ${loading
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-cyan-500 hover:bg-cyan-400 text-white hover:scale-105'
                            }`}
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        {loading ? 'TESTING...' : 'START TEST'}
                    </button>
                </div>
            </div>

            {/* ─── Top Metrics Row ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <StatCard
                    label="Download"
                    value={latestResult ? `${toMbps(latestResult.download)}` : '-'}
                    icon={Download}
                    color="#22d3ee"
                    sub="Mbps"
                />
                <StatCard
                    label="Upload"
                    value={latestResult ? `${toMbps(latestResult.upload)}` : '-'}
                    icon={Upload}
                    color="#34d399"
                    sub="Mbps"
                />
                <StatCard
                    label="Ping"
                    value={latestResult ? `${Math.round(latestResult.ping)}` : '-'}
                    icon={Activity}
                    color="#eab308"
                    sub="ms"
                />
                <StatCard
                    label="Jitter"
                    value={latestResult?.jitter ? `${Math.round(latestResult.jitter)}` : '0'}
                    icon={Wifi}
                    color="#a855f7"
                    sub="ms"
                />
                <StatCard
                    label="Avg Ping"
                    value={avgPing}
                    icon={TrendingUp}
                    color="#f43f5e"
                    sub="all time"
                />
                <StatCard
                    label="Best Down"
                    value={`${toMbps(bestDownload)}`}
                    icon={Zap}
                    color="#3b82f6"
                    sub="Mbps"
                />
                <StatCard
                    label="Total Tests"
                    value={totalTests}
                    icon={Server}
                    color="#8b5cf6"
                    sub="runs"
                />
                <StatCard
                    label="Provider"
                    value={provider.toUpperCase()}
                    icon={Globe}
                    color="#64748b"
                    sub="active"
                />
            </div>

            {/* ─── Main Content Grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Gauge & Control (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 relative overflow-hidden h-full flex flex-col items-center justify-center min-h-[300px]">
                        {/* Provider Toggle */}
                        <div className="absolute top-4 left-4 right-4 flex p-1 bg-black/20 rounded-lg border border-white/5">
                            {['ookla', 'cloudflare'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => !loading && setProvider(p as any)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all uppercase ${provider === p ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-400'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {/* Animated Gauge */}
                        <div className="relative w-64 h-64 mt-8">
                            {/* Background Arc */}
                            <svg className="w-full h-full transform rotate-135" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" stroke="#1f2937" strokeWidth="8" fill="none" strokeDasharray="210" strokeDashoffset="0" strokeLinecap="round" />
                                {/* Progress Arc */}
                                <motion.circle
                                    cx="50" cy="50" r="45"
                                    stroke={latestResult ? '#22d3ee' : '#374151'}
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray="210"
                                    strokeDashoffset={210 - (210 * (loading ? progress : (latestResult ? Math.min(latestResult.download / 100000000, 100) : 0)) / 100)}
                                    strokeLinecap="round"
                                    className="transition-all duration-300"
                                />
                            </svg>
                            {/* Inner Info */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                <span className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Download</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-bold text-white tracking-tighter">
                                        {latestResult ? Math.floor(latestResult.download / 1_000_000) : '0'}
                                    </span>
                                    <span className="text-lg text-gray-500">.{(latestResult ? (latestResult.download / 1_000_000 % 1) * 10 : 0).toFixed(0)}</span>
                                </div>
                                <span className="text-cyan-400 text-sm font-medium mt-1">Mbps</span>

                                {loading && (
                                    <div className="absolute bottom-12 px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded-full animate-pulse border border-cyan-500/20">
                                        RUNNING TEST...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Charts (8 cols) */}
                <div className="lg:col-span-8 bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" /> Bandwidth History
                    </h3>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="time" stroke="#4b5563" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#4b5563" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px', fontSize: '11px' }}
                                    itemStyle={{ color: '#e5e7eb' }}
                                />
                                <Area type="monotone" dataKey="down" stroke="#22d3ee" strokeWidth={2} fill="url(#colorDown)" name="Download (Mbps)" />
                                <Area type="monotone" dataKey="up" stroke="#34d399" strokeWidth={2} fill="url(#colorUp)" name="Upload (Mbps)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ─── Recent Tests Table ─── */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-medium text-white">Recent Tests</h3>
                    </div>
                    <button onClick={fetchHistory} className="text-xs text-gray-500 hover:text-white transition-colors">
                        Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-900/95 border-b border-gray-800">
                            <tr>
                                <th className="text-left text-gray-500 font-medium px-5 py-3 text-xs">DATE & TIME</th>
                                <th className="text-left text-gray-500 font-medium px-5 py-3 text-xs">PROVIDER</th>
                                <th className="text-left text-gray-500 font-medium px-5 py-3 text-xs">SERVER</th>
                                <th className="text-right text-gray-500 font-medium px-5 py-3 text-xs">DOWNLOAD</th>
                                <th className="text-right text-gray-500 font-medium px-5 py-3 text-xs">UPLOAD</th>
                                <th className="text-right text-gray-500 font-medium px-5 py-3 text-xs">PING</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={6} className="text-center text-gray-600 py-8">No test history found</td></tr>
                            ) : (
                                history.slice(0, 10).map((result, i) => (
                                    <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors">
                                        <td className="px-5 py-3 font-mono text-gray-400 text-xs">
                                            {new Date(result.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${result.provider === 'ookla'
                                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                }`}>
                                                {result.provider}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-300 text-xs">
                                            {result.server.name || 'Auto'} <span className="text-gray-600">({result.server.country || 'Unknown'})</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-cyan-400 text-xs text-right font-bold">
                                            {toMbps(result.download)} <span className="text-gray-600 text-[10px] font-normal">Mbps</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-emerald-400 text-xs text-right font-bold">
                                            {toMbps(result.upload)} <span className="text-gray-600 text-[10px] font-normal">Mbps</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-amber-400 text-xs text-right font-bold">
                                            {Math.round(result.ping)} <span className="text-gray-600 text-[10px] font-normal">ms</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SpeedtestSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

export default SpeedtestPage;
