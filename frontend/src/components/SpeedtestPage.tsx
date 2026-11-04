import { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
    Activity, Wifi, Zap, Server, Globe,
    Settings, Play, Clock, TrendingUp,
    Download, Upload, RefreshCw, Share2, MapPin, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

import SpeedtestService, { SpeedtestResult } from '../services/SpeedtestService';
import SpeedtestSettingsModal from './SpeedtestSettingsModal';
import { cn } from '../lib/utils';

// ─── Design Components ───

// Stat Card (Console style)
const StatCard = ({ label, value, icon: Icon, color, sub, trend }: {
    label: string; value: string | number; icon: React.ElementType; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="panel p-3 rounded-[7px] border border-line bg-panel flex flex-col justify-between hover:border-line-strong transition-colors">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{label}</span>
            <div className="w-5 h-5 rounded-[4px] flex items-center justify-center bg-raised border border-line">
                <Icon className="h-3 w-3" style={{ color }} />
            </div>
        </div>
        <div className="text-base font-semibold text-text font-mono num leading-tight my-1 truncate">{value}</div>
        {sub && (
            <div className="flex items-center gap-1 font-mono text-[10px] text-text-soft">
                {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-ok" />}
                {trend === 'down' && <TrendingUp className="w-2.5 h-2.5 text-danger rotate-180" />}
                <span className="truncate">{sub}</span>
            </div>
        )}
    </div>
);

const SpeedtestPage = () => {
    // State
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [history, setHistory] = useState<SpeedtestResult[]>([]);
    const [latestResult, setLatestResult] = useState<SpeedtestResult | null>(null);
    const [provider, setProvider] = useState<'ookla' | 'cloudflare'>('ookla');
    const [activePhase, setActivePhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'complete'>('idle');
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
            toast.error('Failed to load speedtest history');
        }
    }, []);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await SpeedtestService.getHistory();
                setHistory(data);
                if (data.length > 0) {
                    setLatestResult(data[0]);
                }
            } catch (error) {
                console.error('Failed to load history:', error);
                toast.error('Failed to load speedtest history');
            }
        };
        loadHistory();
    }, []);

    // Run Test
    const runSpeedtest = useCallback(() => {
        if (loading) return;
        setLoading(true);
        setProgress(0);
        setActivePhase('idle');
        setLatestResult(null);

        // In development, we use the Vite proxy (which is configured for /api)
        // Using window.location.host ensures we use the proxy port (5173) in dev 
        // and the correct host in production.
        const token = localStorage.getItem('statsea_token');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/speedtest?provider=${provider}&token=${token}`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
        };

        socket.onerror = (error) => {
            console.error('Speedtest WebSocket error:', error);
            toast.error('Connection error occurred. Please check if the backend is running.');
            setLoading(false);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.error) {
                    toast.error(`Speedtest failed: ${data.error}`);
                    socket.close();
                    return;
                }

                if (data.phase) {
                    setActivePhase(data.phase);
                }

                if (data.phase === 'ping') {
                    // Update ping
                    setLatestResult(prev => {
                        const base = prev || {
                            id: 0,
                            ping: 0,
                            jitter: 0,
                            download: 0,
                            upload: 0,
                            server: { name: 'Selecting...', country: '', id: '0' },
                            timestamp: new Date().toISOString(),
                            provider: provider,
                            isp: '...'
                        };
                        return {
                            ...base,
                            ping: data.val || 0
                        };
                    });
                    if (data.progress) setProgress(data.progress * 0.1); // Ping is first 10%
                } else if (data.phase === 'download') {
                    // Update download
                    setLatestResult(prev => {
                        if (!prev) return prev; // Should have been initialized in ping
                        return { ...prev, download: data.val || 0 };
                    });
                    // Download is 10-55%
                    if (data.progress) setProgress(10 + (data.progress * 0.45));
                } else if (data.phase === 'upload') {
                    // Update upload
                    setLatestResult(prev => {
                        if (!prev) return prev;
                        return { ...prev, upload: data.val || 0 };
                    });
                    // Upload is 55-100%
                    if (data.progress) setProgress(55 + (data.progress * 0.45));
                } else if (data.phase === 'complete') {
                    setLatestResult(data.result);
                    setProgress(100);
                    toast.success('Speedtest completed successfully');
                    fetchHistory();
                    socket.close();
                }
            } catch (e) {
                console.error('Error parsing WS message:', e);
            }
        };

        socket.onclose = () => {
            setLoading(false);
        };

    }, [loading, provider, fetchHistory]);

    const handleShare = () => {
        if (!latestResult) return;
        const text = `🚀 My Internet Speed (${latestResult.provider}):
⬇️ Download: ${(latestResult.download / 1_000_000).toFixed(1)} Mbps
⬆️ Upload: ${(latestResult.upload / 1_000_000).toFixed(1)} Mbps
📶 Ping: ${Math.round(latestResult.ping)} ms
📍 Server: ${latestResult.server.name}
Generated by StatSea`;
        navigator.clipboard.writeText(text);
        toast.success('Result copied to clipboard!');
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

    // Comparison Data (Based on averages and static global baseline)
    const avgDown = history.length > 0 ? history.reduce((a, b) => a + b.download, 0) / history.length : 0;
    const compareData = [
        { name: 'Your Speed', value: latestResult ? latestResult.download : 0, color: '#22d3ee' },
        { name: 'Avg History', value: avgDown, color: '#34d399' },
        { name: 'Global Avg', value: 150 * 1_000_000, color: '#64748b' }, // Global fixed baseline
    ];

    // ISP Change detection
    let ispChanged = false;
    let previousIsp = '';
    if (history.length > 1) {
        if (history[0].isp && history[1].isp && history[0].isp !== history[1].isp && history[0].isp !== 'Unknown ISP' && history[1].isp !== 'Unknown ISP') {
            ispChanged = true;
            previousIsp = history[1].isp;
        }
    }

    return (
        <div className="space-y-4">
            {/* ─── Header ─── */}
            <div className="panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Speedtest Intelligence</h1>
                            <span className={cn(
                                "status text-[10px] uppercase font-mono px-2 py-0.5",
                                loading ? "warn" : "ok"
                            )}>
                                {loading ? 'TESTING' : `${provider.toUpperCase()} ENGINE`}
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">Advanced network throughput & latency benchmarking</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleShare}
                        disabled={!latestResult}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text rounded-[7px] font-mono text-xs transition-colors disabled:opacity-50"
                        title="Copy result to clipboard"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        SHARE
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text rounded-[7px] font-mono text-xs transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        SETTINGS
                    </button>
                    <button
                        onClick={runSpeedtest}
                        disabled={loading}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-[7px] text-xs font-semibold font-mono transition-opacity shadow-sm",
                            loading
                                ? "bg-raised border border-line text-warn cursor-not-allowed"
                                : "bg-accent hover:opacity-90 text-accent-foreground"
                        )}
                    >
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        {loading ? 'TESTING...' : 'RUN BENCHMARK'}
                    </button>
                </div>
            </div>

            {/* ─── Top Metrics Row ─── */}
            {ispChanged && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold">ISP Change Detected</h4>
                        <p className="text-xs opacity-90 mt-0.5">Your internet provider changed from <strong className="text-amber-400">{previousIsp}</strong> to <strong className="text-amber-400">{history[0].isp}</strong>.</p>
                    </div>
                </div>
            )}
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
                    label="ISP"
                    value={latestResult?.isp || '-'}
                    icon={Globe}
                    color="#f472b6"
                    sub="provider"
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
                    color="#06b6d4"
                    sub="runs"
                />
                <StatCard
                    label="Active"
                    value={provider.toUpperCase()}
                    icon={Wifi}
                    color="#64748b"
                    sub="engine"
                />
            </div>

            {/* ─── Main Content Grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Gauge & Info (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="panel p-6 rounded-[var(--r-panel)] border border-line bg-panel relative overflow-hidden h-full flex flex-col items-center justify-center min-h-[350px]">
                        {/* Provider Toggle */}
                        <div className="absolute top-4 left-4 right-4 flex p-1 bg-raised rounded-[7px] border border-line z-10 font-mono">
                            {['ookla', 'cloudflare'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => !loading && setProvider(p as 'ookla' | 'cloudflare')}
                                    className={`flex-1 py-1 text-xs font-semibold rounded-[5px] transition-all uppercase ${
                                        provider === p ? 'bg-panel text-accent border border-line shadow-xs' : 'text-text-soft hover:text-text'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {/* Animated Gauge */}
                        <div className="relative w-64 h-64 mt-8">
                            {/* SVG Gauge: 270° arc (¾ circle), r=45, C=2π×45≈282.7, arc=282.7×(270/360)≈212 */}
                            <svg className="w-full h-full transform rotate-[135deg]" viewBox="0 0 100 100">
                                {/* Background track */}
                                <circle cx="50" cy="50" r="45" stroke="currentColor" className="text-muted/20" strokeWidth="6" fill="none" strokeDasharray="212 283" strokeLinecap="round" />
                                {/* Progress Arc */}
                                <circle
                                    cx="50" cy="50" r="45"
                                    stroke={loading ? (activePhase === 'upload' ? 'var(--ok)' : 'var(--upload)') : (latestResult ? (latestResult.download > 500_000_000 ? 'var(--accent)' : 'var(--upload)') : 'currentColor')}
                                    className={!loading && !latestResult ? "text-muted/40" : ""}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeDasharray="212 283"
                                    strokeDashoffset={loading
                                        ? 212 - (212 * (progress / 100))
                                        : (latestResult
                                            ? 212 - (212 * Math.min(latestResult.download / 1_000_000_000, 1))
                                            : 212)}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
                                />
                            </svg>
                            {/* Inner Info */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4 font-mono">
                                <span className="text-faint text-xs font-bold tracking-widest uppercase mb-1">
                                    {loading ? (activePhase === 'upload' ? 'Upload' : activePhase === 'download' ? 'Download' : 'Ping') : 'Download'}
                                </span>
                                <div className="flex items-baseline gap-1">
                                    {(() => {
                                        // Determine the current speed value to display
                                        const currentSpeed = loading
                                            ? (activePhase === 'upload' ? latestResult?.upload : latestResult?.download) || 0
                                            : (latestResult?.download || 0);
                                        const mbps = currentSpeed / 1_000_000;
                                        const isActivelyTesting = loading && (activePhase === 'download' || activePhase === 'upload') && currentSpeed === 0;

                                        if (isActivelyTesting) {
                                            return (
                                                <span className="text-5xl font-bold text-text tracking-tighter animate-pulse num">—</span>
                                            );
                                        }
                                        return (
                                            <>
                                                <span className="text-5xl font-bold text-text tracking-tighter num">
                                                    {Math.floor(mbps)}
                                                </span>
                                                <span className="text-lg text-text-soft num">
                                                    .{Math.floor((mbps % 1) * 10)}
                                                </span>
                                            </>
                                        );
                                    })()}
                                </div>
                                <span className={loading && activePhase === 'upload' ? "text-ok text-sm font-semibold mt-1" : "text-upload text-sm font-semibold mt-1"}>Mbps</span>

                                {/* Inline Start Button */}
                                {!loading && (
                                    <button
                                        onClick={runSpeedtest}
                                        className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-[7px] text-[11px] font-bold tracking-wider uppercase bg-accent text-accent-foreground hover:opacity-90 hover:scale-105 transition-all shadow-sm"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                        RUN
                                    </button>
                                )}

                                {loading && (
                                    <div className={`absolute bottom-12 px-3 py-1 text-[10px] font-bold rounded-[5px] animate-pulse border font-mono ${activePhase === 'upload'
                                        ? 'bg-raised text-ok border-ok/30'
                                        : 'bg-raised text-upload border-upload/30'
                                        }`}>
                                        {activePhase === 'upload' ? 'UPLOADING...' : activePhase === 'download' ? 'DOWNLOADING...' : 'PREPARING...'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Server & ISP Info Below Gauge */}
                        {latestResult && !loading && (
                            <div className="w-full mt-4 flex items-center justify-between text-xs px-4 border-t border-line pt-4 font-mono">
                                <div className="flex items-center gap-2 text-text-soft">
                                    <Globe className="w-3.5 h-3.5 text-accent" />
                                    <span>{latestResult.isp}</span>
                                </div>
                                <div className="flex items-center gap-2 text-text-soft">
                                    <MapPin className="w-3.5 h-3.5 text-upload" />
                                    <span>{latestResult.server.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Charts (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    {/* Bandwidth History Chart */}
                    <div className="panel p-4 flex-1">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text mb-3 flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-accent" /> Bandwidth History
                        </h3>
                        <div className="h-[200px]">
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                                    <XAxis dataKey="time" stroke="currentColor" className="text-muted-foreground" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Area type="monotone" dataKey="down" stroke="#22d3ee" strokeWidth={2} fill="url(#colorDown)" name="Download (Mbps)" />
                                    <Area type="monotone" dataKey="up" stroke="#34d399" strokeWidth={2} fill="url(#colorUp)" name="Upload (Mbps)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Secondary Charts View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[210px]">
                        {/* Comparison Chart */}
                        <div className="panel p-4 h-full flex flex-col">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-text mb-3 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-accent" /> Speed Comparison
                            </h3>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={compareData} layout="vertical" barSize={12} margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                                        <XAxis type="number" stroke="currentColor" className="text-muted-foreground" fontSize={10} hide />
                                        <YAxis dataKey="name" type="category" stroke="currentColor" className="text-muted-foreground" fontSize={11} width={85} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }}
                                            formatter={(value: number) => [`${(value / 1_000_000).toFixed(1)} Mbps`]}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {compareData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Ping Trend Chart */}
                        <div className="panel p-4 h-full flex flex-col">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-text mb-3 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-warn" /> Latency Trend
                            </h3>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ left: -25, right: 10, top: 10 }}>
                                        <defs>
                                            <linearGradient id="colorPing" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                                        <XAxis dataKey="time" stroke="currentColor" className="text-muted-foreground" fontSize={10} axisLine={false} tickLine={false} hide />
                                        <YAxis dataKey="ping" stroke="currentColor" className="text-muted-foreground" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--foreground)' }}
                                            itemStyle={{ color: 'var(--foreground)' }}
                                        />
                                        <Area type="monotone" dataKey="ping" stroke="#fbbf24" strokeWidth={2} fill="url(#colorPing)" name="Ping (ms)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Recent Tests Table ─── */}
            <div className="panel p-0 overflow-hidden">
                <div className="panel-head border-b border-line px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        <span className="font-mono text-xs uppercase tracking-wider text-text font-medium">Recent Benchmark Runs</span>
                    </div>
                    <button onClick={fetchHistory} className="text-xs font-mono text-text-soft hover:text-text transition-colors">
                        Refresh
                    </button>
                </div>
                <div className="table-wrap">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-line bg-raised/50 text-faint uppercase font-mono text-[10px] tracking-wider">
                                <th className="px-4 py-2 font-medium">Date & Time</th>
                                <th className="px-4 py-2 font-medium">Provider</th>
                                <th className="px-4 py-2 font-medium">ISP</th>
                                <th className="px-4 py-2 font-medium">Server</th>
                                <th className="px-4 py-2 font-medium text-right">Download</th>
                                <th className="px-4 py-2 font-medium text-right">Upload</th>
                                <th className="px-4 py-2 font-medium text-right">Ping</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {history.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-text-soft font-mono py-8 text-xs">No benchmark history recorded</td></tr>
                            ) : (
                                history.slice(0, 10).map((result, i) => (
                                    <tr key={i} className="hover:bg-raised/60 transition-colors">
                                        <td className="px-4 py-2.5 font-mono text-faint text-xs">
                                            {new Date(result.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="status ok text-[9px] uppercase font-mono px-1.5 py-0.5">
                                                {result.provider}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-text-soft text-xs font-mono">
                                            {result.isp || 'Unknown'}
                                        </td>
                                        <td className="px-4 py-2.5 text-text text-xs">
                                            {result.server.name || 'Auto'} <span className="text-faint font-mono text-[10px]">({result.server.country || 'Unknown'})</span>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-ok text-xs text-right font-semibold num">
                                            {toMbps(result.download)} <span className="text-text-soft font-normal text-[10px]">Mbps</span>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-upload text-xs text-right font-semibold num">
                                            {toMbps(result.upload)} <span className="text-text-soft font-normal text-[10px]">Mbps</span>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-warn text-xs text-right font-semibold num">
                                            {Math.round(result.ping)} <span className="text-text-soft font-normal text-[10px]">ms</span>
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

