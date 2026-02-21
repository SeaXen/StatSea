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

// ─── Design Components ───

// Stat Card (Matching AnalyticsDashboard)
const StatCard = ({ label, value, icon: Icon, color, sub, trend }: {
    label: string; value: string | number; icon: React.ElementType; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden group hover:border-border/80 transition-all duration-300 hover:shadow-lg" style={{ '--glow': color } as React.CSSProperties}>
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
        </div>
        <span className="text-2xl font-bold text-foreground font-mono truncate">{value}</span>
        {sub && (
            <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                {trend === 'down' && <TrendingUp className="w-3 h-3 text-red-400 rotate-180" />}
                <span className="text-[11px] text-muted-foreground truncate">{sub}</span>
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

        console.log('Connecting to Speedtest WebSocket:', wsUrl);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Speedtest receive socket connected');
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

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            toast.error('Connection error');
            setLoading(false);
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

    // Comparison Data (Mock for now, or based on average)
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
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        <Activity className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
                        Speedtest Intelligence
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Advanced network performance analytics & automation</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleShare}
                        disabled={!latestResult}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Copy result to clipboard"
                    >
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-all font-medium text-sm"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                    <button
                        onClick={runSpeedtest}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all ${loading
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-white hover:scale-105'
                            }`}
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        {loading ? 'TESTING...' : 'START TEST'}
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
                    color="#8b5cf6"
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
                    <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden h-full flex flex-col items-center justify-center min-h-[350px]">
                        {/* Provider Toggle */}
                        <div className="absolute top-4 left-4 right-4 flex p-1 bg-muted/50 rounded-lg border border-border z-10">
                            {['ookla', 'cloudflare'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => !loading && setProvider(p as 'ookla' | 'cloudflare')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all uppercase ${provider === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
                                    stroke={loading ? (activePhase === 'upload' ? '#34d399' : '#22d3ee') : (latestResult ? (latestResult.download > 500_000_000 ? '#a855f7' : '#22d3ee') : 'currentColor')}
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
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase mb-1">
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
                                            // Show animated dash while waiting for first speed value
                                            return (
                                                <>
                                                    <span className="text-5xl font-bold text-foreground tracking-tighter animate-pulse">—</span>
                                                </>
                                            );
                                        }
                                        return (
                                            <>
                                                <span className="text-5xl font-bold text-foreground tracking-tighter">
                                                    {Math.floor(mbps)}
                                                </span>
                                                <span className="text-lg text-muted-foreground">
                                                    .{Math.floor((mbps % 1) * 10)}
                                                </span>
                                            </>
                                        );
                                    })()}
                                </div>
                                <span className={loading && activePhase === 'upload' ? "text-emerald-400 text-sm font-medium mt-1" : "text-cyan-400 text-sm font-medium mt-1"}>Mbps</span>

                                {/* Inline Start Button */}
                                {!loading && (
                                    <button
                                        onClick={runSpeedtest}
                                        className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-500/50 hover:scale-105 transition-all shadow-lg shadow-cyan-500/10"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                        GO
                                    </button>
                                )}

                                {loading && (
                                    <div className={`absolute bottom-12 px-3 py-1 text-[10px] font-bold rounded-full animate-pulse border ${activePhase === 'upload'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                        }`}>
                                        {activePhase === 'upload' ? 'UPLOADING...' : activePhase === 'download' ? 'DOWNLOADING...' : 'PREPARING...'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Server & ISP Info Below Gauge */}
                        {latestResult && !loading && (
                            <div className="w-full mt-4 flex items-center justify-between text-xs px-4 border-t border-border pt-4">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Globe className="w-3 h-3" />
                                    <span>{latestResult.isp}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="w-3 h-3" />
                                    <span>{latestResult.server.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Charts (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Bandwidth History Chart */}
                    <div className="bg-card border border-border rounded-xl p-5 flex-1">
                        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cyan-400" /> Bandwidth History
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[200px]">
                        {/* Comparison Chart */}
                        <div className="bg-card border border-border rounded-xl p-5 h-full flex flex-col">
                            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-400" /> Speed Comparison
                            </h3>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={compareData} layout="vertical" barSize={12} margin={{ left: -30, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" horizontal={false} />
                                        <XAxis type="number" stroke="currentColor" className="text-muted-foreground" fontSize={10} hide />
                                        <YAxis dataKey="name" type="category" stroke="currentColor" className="text-muted-foreground" fontSize={11} width={80} tickLine={false} axisLine={false} />
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
                        <div className="bg-card border border-border rounded-xl p-5 h-full flex flex-col">
                            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-amber-400" /> Latency Trend
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
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium text-foreground">Recent Tests</h3>
                    </div>
                    <button onClick={fetchHistory} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">DATE & TIME</th>
                                <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">PROVIDER</th>
                                <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">ISP</th>
                                <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">SERVER</th>
                                <th className="text-right text-muted-foreground font-medium px-5 py-3 text-xs">DOWNLOAD</th>
                                <th className="text-right text-muted-foreground font-medium px-5 py-3 text-xs">UPLOAD</th>
                                <th className="text-right text-muted-foreground font-medium px-5 py-3 text-xs">PING</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No test history found</td></tr>
                            ) : (
                                history.slice(0, 10).map((result, i) => (
                                    <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                                        <td className="px-5 py-3 font-mono text-muted-foreground text-xs">
                                            {new Date(result.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${result.provider === 'ookla'
                                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                }`}>
                                                {result.provider}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground text-xs font-medium">
                                            {result.isp || 'Unknown'}
                                        </td>
                                        <td className="px-5 py-3 text-foreground text-xs">
                                            {result.server.name || 'Auto'} <span className="text-muted-foreground">({result.server.country || 'Unknown'})</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-cyan-500 dark:text-cyan-400 text-xs text-right font-bold">
                                            {toMbps(result.download)} <span className="text-muted-foreground text-[10px] font-normal">Mbps</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-emerald-500 dark:text-emerald-400 text-xs text-right font-bold">
                                            {toMbps(result.upload)} <span className="text-muted-foreground text-[10px] font-normal">Mbps</span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-amber-500 dark:text-amber-400 text-xs text-right font-bold">
                                            {Math.round(result.ping)} <span className="text-muted-foreground text-[10px] font-normal">ms</span>
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

