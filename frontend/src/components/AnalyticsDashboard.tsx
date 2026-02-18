import { useState, useEffect, useRef } from 'react';
import DnsQueryLog from './DnsQueryLog';
import NetworkComparison from './NetworkComparison';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import {
    Shield, AlertTriangle, Activity, Zap, Pause, Play, Search, Globe, Wifi, Server,
    Database, Radio, Layers, BarChart3, TrendingUp, Monitor, Network, Settings,
    ArrowRightLeft
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';


// ─── Protocol Color Map ───
const PROTO_COLORS: Record<string, string> = {
    TCP: '#22d3ee',
    UDP: '#34d399',
    HTTP: '#f97316',
    HTTPS: '#3b82f6',
    DNS: '#eab308',
    ICMP: '#a855f7',
    SSH: '#14b8a6',
    FTP: '#f43f5e',
    OTHER: '#6b7280'
};

const SIZE_COLORS: Record<string, string> = {
    "tiny (<128B)": '#22d3ee',
    "small (128-512B)": '#34d399',
    "medium (512-1024B)": '#f59e0b',
    "large (1024B+)": '#f43f5e'
};

// ─── Interfaces ───
interface AnalyticsData {
    total_packets: number;
    total_bytes: number;
    packets_per_sec: number;
    suspicious: number;
    upload_rate: number;
    download_rate: number;
    protocols: Record<string, number>;
    top_devices: Array<{
        mac: string;
        ip: string;
        hostname?: string;
        upload: number;
        download: number;
        total: number;
    }>;
    packet_log: Array<{
        time: string;
        proto: string;
        src: string;
        dst: string;
        size: number;
        suspicious?: boolean;
    }>;
    active_device_count: number;
    // Extended
    bandwidth_history: Array<{ time: string; up: number; down: number }>;
    packet_size_distribution: Record<string, number>;
    dns_queries: number;
    http_requests: number;
    active_sessions: number;
    connection_types: Record<string, number>;
    bytes_per_protocol: Record<string, number>;
}

interface BandwidthPoint {
    timestamp: string;
    upload_bytes: number;
    download_bytes: number;
}

interface LatencyPoint {
    timestamp: string;
    target: string;
    latency_ms: number;
}

interface SecurityEvent {
    id: number;
    timestamp: string;
    event_type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    source_ip: string;
    resolved: boolean;
}

interface ExternalConnection {
    ip: string;
    bytes: number;
    hits: number;
    city: string;
    country: string;
}

interface SystemHistoryPoint {
    timestamp: string;
    interface: string;
    bytes_sent: number;
    bytes_recv: number;
}

interface DashboardConfig {
    showStatsRow: boolean;
    showLiveBandwidth: boolean;
    showGauges: boolean;
    showProtocolFilters: boolean;
    showProtocolCharts: boolean;
    showPacketCharts: boolean;
}

// ─── Helper ───
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

// ─── Stat Card ───
const StatCard = ({ label, value, icon: Icon, color, sub, trend }: {
    label: string; value: string | number; icon: any; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 flex flex-col gap-0.5 relative overflow-hidden group hover:border-gray-700 transition-all duration-300 hover:shadow-lg" style={{ '--glow': color } as React.CSSProperties}>
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${color}15` }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>
        </div>
        <span className="text-xl font-bold text-white font-mono leading-tight">{value}</span>
        {sub && (
            <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />}
                {trend === 'down' && <TrendingUp className="w-2.5 h-2.5 text-red-400 rotate-180" />}
                <span className="text-[10px] text-gray-500 truncate">{sub}</span>
            </div>
        )}
        <div className="absolute bottom-0 left-0 h-[1.5px] w-full opacity-30 group-hover:opacity-50 transition-opacity" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
);



// ─── Circular Gauge ───
const CircularGauge = ({ percentage, rate, label, color, dotColor }: {
    percentage: number; rate: string; label: string; color: string; dotColor: string;
}) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} stroke="#1f2937" strokeWidth="6" fill="none" />
                    <circle
                        cx="50" cy="50" r={radius} stroke={color} strokeWidth="6" fill="none"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round" className="transition-all duration-700"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-2 h-2 rounded-full mb-1" style={{ background: dotColor }} />
                    <span className="text-lg font-bold text-white">{percentage}%</span>
                    <span className="text-[10px] text-gray-400">{rate}</span>
                </div>
            </div>
            <span className="text-xs text-gray-500">{label}</span>
        </div>
    );
};

// ─── Protocol Badge ───
const ProtocolBadge = ({ proto, active, onClick }: { proto: string; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 border ${active
            ? 'scale-105 shadow-lg'
            : 'opacity-40 hover:opacity-70 border-transparent'
            }`}
        style={{
            color: PROTO_COLORS[proto] || '#9ca3af',
            borderColor: active ? (PROTO_COLORS[proto] || '#9ca3af') : 'transparent',
            background: active ? `${PROTO_COLORS[proto]}15` : 'transparent'
        }}
    >
        {proto}
    </button>
);

// ─── MAIN COMPONENT ───
const AnalyticsDashboard = () => {
    const [activeView, setActiveView] = useState<'live' | 'statistics' | 'connections' | 'security' | 'history' | 'dns' | 'comparison'>('live');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [bandwidthData, setBandwidthData] = useState<BandwidthPoint[]>([]);
    const [latencyData, setLatencyData] = useState<LatencyPoint[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [externalConnections, setExternalConnections] = useState<ExternalConnection[]>([]);
    const [systemHistory, setSystemHistory] = useState<SystemHistoryPoint[]>([]); // New state
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [paused, setPaused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeProtocols, setActiveProtocols] = useState<Set<string>>(new Set(['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'SSH', 'FTP']));
    const [showSettings, setShowSettings] = useState(false);
    const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(() => {
        const saved = localStorage.getItem('dashboardConfig');
        return saved ? JSON.parse(saved) : {
            showStatsRow: true,
            showLiveBandwidth: true,
            showGauges: true,
            showProtocolFilters: true,
            showProtocolCharts: true,
            showPacketCharts: true
        };
    });

    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem('dashboardConfig', JSON.stringify(dashboardConfig));
    }, [dashboardConfig]);

    const toggleProtocol = (proto: string) => {
        setActiveProtocols(prev => {
            const next = new Set(prev);
            if (next.has(proto)) next.delete(proto);
            else next.add(proto);
            return next;
        });
    };

    const toggleWidget = (key: keyof DashboardConfig) => {
        setDashboardConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
        const fetchData = async () => {
            if (paused) return;
            try {
                const [analyticsRes, netRes, secRes, connRes] = await Promise.all([
                    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS.SUMMARY}`),
                    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY}`),
                    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SECURITY.EVENTS}`),
                    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NETWORK.CONNECTIONS}`)
                ]);

                if (analyticsRes.ok) setAnalyticsData(await analyticsRes.json());
                if (netRes.ok) {
                    const netData = await netRes.json();
                    setBandwidthData(netData.bandwidth.map((i: any) => ({
                        ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                    })).reverse());
                    setLatencyData(netData.latency.map((i: any) => ({
                        ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                    })).reverse());
                }
                if (secRes.ok) setSecurityEvents(await secRes.json());
                if (connRes.ok) setExternalConnections(await connRes.json());
            } catch (error) {
                console.error("Failed to fetch analytics data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, [paused]);

    // Fetch history when view changes to history
    useEffect(() => {
        if (activeView === 'history') {
            const fetchHistory = async () => {
                setHistoryLoading(true);
                try {
                    const res = await fetch(`${API_CONFIG.BASE_URL}/system/network/history?hours=24`);
                    if (res.ok) {
                        const data = await res.json();
                        setSystemHistory(data);
                    }
                } catch (e) {
                    console.error("Failed to fetch system history", e);
                } finally {
                    setHistoryLoading(false);
                }
            };
            fetchHistory();
        }
    }, [activeView]);

    // Auto-scroll live stream
    useEffect(() => {
        if (logRef.current && activeView === 'live' && !paused) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [analyticsData?.packet_log, activeView, paused]);

    if (loading && !analyticsData) return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-gray-500 gap-4">
            <Activity className="w-8 h-8 animate-pulse text-cyan-500" />
            <span>Initializing Traffic Analyzer...</span>
        </div>
    );

    if (!analyticsData) return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-gray-500 gap-4">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <h3 className="text-xl font-semibold text-white">Backend Unavailable</h3>
            <p className="max-w-md text-center text-gray-400">
                Could not connect to the analysis engine. Please ensure the backend server is running.
            </p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
            >
                Retry Connection
            </button>
        </div>
    );

    const totalTraffic = analyticsData.upload_rate + analyticsData.download_rate;
    const downPct = totalTraffic > 0 ? Math.round((analyticsData.download_rate / totalTraffic) * 100) : 0;
    const upPct = totalTraffic > 0 ? Math.round((analyticsData.upload_rate / totalTraffic) * 100) : 0;

    // Protocol data for pie chart
    const protocolChartData = Object.entries(analyticsData.protocols).map(([name, value]) => ({
        name, value, color: PROTO_COLORS[name] || '#6b7280'
    }));

    // Packet size distribution for bar chart
    const sizeDistData = Object.entries(analyticsData.packet_size_distribution || {}).map(([name, value]) => ({
        name: name.replace(/[()]/g, '').replace('<', '<').replace('>', '>'),
        shortName: name.split(' ')[0],
        value,
        color: SIZE_COLORS[name] || '#6b7280'
    }));

    // Bytes per protocol for bar chart
    const bytesPerProtoData = Object.entries(analyticsData.bytes_per_protocol || {})
        .map(([name, value]) => ({ name, value, color: PROTO_COLORS[name] || '#6b7280' }))
        .sort((a, b) => b.value - a.value);

    // Connection types for mini pie
    const connTypeData = Object.entries(analyticsData.connection_types || {}).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: name === 'external' ? '#3b82f6' : '#34d399'
    }));

    // Filtered packet log
    const filteredLog = (analyticsData.packet_log || []).filter(pkt => {
        if (!activeProtocols.has(pkt.proto)) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return pkt.src.toLowerCase().includes(q) || pkt.dst.toLowerCase().includes(q) || pkt.proto.toLowerCase().includes(q);
        }
        return true;
    });

    const allProtocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'SSH', 'FTP'];

    return (
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Activity className="w-7 h-7 text-cyan-400" />
                        Traffic Analyzer
                    </h1>
                    <p className="text-gray-400 mt-0.5 text-xs">Real-time packet monitoring and deep analysis</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-gray-800 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                        <span className="text-xs text-gray-400">{paused ? 'Paused' : 'Capturing'}</span>
                    </div>
                    <button onClick={() => setPaused(!paused)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${paused
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                            }`}>
                        {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-gray-800 border-gray-600 text-cyan-400' : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-white'}`}
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Settings Dropdown */}
                        {showSettings && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Dashboard Layout</h4>
                                <div className="space-y-1">
                                    {[
                                        { key: 'showStatsRow', label: 'Key Statistics' },
                                        { key: 'showLiveBandwidth', label: 'Live Bandwidth Graph' },
                                        { key: 'showGauges', label: 'Network Gauges' },
                                        { key: 'showProtocolFilters', label: 'Protocol Filters' },
                                        { key: 'showProtocolCharts', label: 'Protocol Distribution' },
                                        { key: 'showPacketCharts', label: 'Packet Size/Volume' },

                                    ].map(item => (
                                        <button
                                            key={item.key}
                                            onClick={() => toggleWidget(item.key as keyof DashboardConfig)}
                                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-800 rounded-lg text-xs text-gray-300 transition-colors"
                                        >
                                            <span>{item.label}</span>
                                            <div className={`w-8 h-4 rounded-full relative transition-colors ${dashboardConfig[item.key as keyof DashboardConfig] ? 'bg-cyan-500/20' : 'bg-gray-700'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${dashboardConfig[item.key as keyof DashboardConfig] ? 'left-4.5 bg-cyan-400' : 'left-0.5 bg-gray-500'}`} style={{ left: dashboardConfig[item.key as keyof DashboardConfig] ? '18px' : '2px' }} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Stats Row (8 cards) ─── */}
            {dashboardConfig.showStatsRow && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <StatCard label="Packets" value={formatNumber(analyticsData.total_packets)} icon={Zap} color="#22d3ee" sub="total captured" />
                    <StatCard label="Data" value={formatBytes(analyticsData.total_bytes)} icon={Database} color="#34d399" sub="transferred" />
                    <StatCard label="PPS" value={`${analyticsData.packets_per_sec}`} icon={Activity} color="#a855f7" sub="packets/sec" trend="up" />
                    <StatCard label="Suspicious" value={analyticsData.suspicious} icon={AlertTriangle} color={analyticsData.suspicious > 0 ? '#f43f5e' : '#6b7280'} sub="flagged" trend={analyticsData.suspicious > 0 ? 'up' : 'neutral'} />
                    <StatCard label="DNS" value={formatNumber(analyticsData.dns_queries)} icon={Globe} color="#eab308" sub="queries" />
                    <StatCard label="HTTP" value={formatNumber(analyticsData.http_requests)} icon={Network} color="#f97316" sub="requests" />
                    <StatCard label="Sessions" value={analyticsData.active_sessions} icon={Radio} color="#14b8a6" sub="active" trend="up" />
                    <StatCard label="Devices" value={analyticsData.active_device_count} icon={Monitor} color="#8b5cf6" sub="online" />
                </div>
            )}

            {/* ─── Live Bandwidth Timeline + Gauges + Protocol Filters ─── */}
            <div className={`grid grid-cols-1 ${dashboardConfig.showLiveBandwidth && dashboardConfig.showGauges && dashboardConfig.showProtocolFilters ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
                {/* Live Bandwidth Timeline */}
                {dashboardConfig.showLiveBandwidth && (
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                        <h3 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Live Bandwidth
                        </h3>
                        <div className="h-[100px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analyticsData.bandwidth_history || []}>
                                    <defs>
                                        <linearGradient id="liveDown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="liveUp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="#374151" fontSize={9} tickCount={4} />
                                    <YAxis stroke="#374151" fontSize={9} tickFormatter={(v: number) => formatBytes(v)} width={50} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px', fontSize: '11px' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        formatter={(value: number) => formatBytes(value)}
                                    />
                                    <Area type="monotone" dataKey="down" stroke="#22d3ee" strokeWidth={1.5} fill="url(#liveDown)" dot={false} name="Download" />
                                    <Area type="monotone" dataKey="up" stroke="#34d399" strokeWidth={1.5} fill="url(#liveUp)" dot={false} name="Upload" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Gauges */}
                {dashboardConfig.showGauges && (
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4 flex items-center justify-center gap-6">
                        <CircularGauge percentage={downPct} rate={formatBytes(analyticsData.download_rate) + '/s'} label="Download" color="#22d3ee" dotColor="#22d3ee" />
                        <CircularGauge percentage={upPct} rate={formatBytes(analyticsData.upload_rate) + '/s'} label="Upload" color="#34d399" dotColor="#34d399" />
                    </div>
                )}

                {/* Protocol Filters */}
                {dashboardConfig.showProtocolFilters && (
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                        <h3 className="text-xs font-medium text-gray-400 mb-2">Protocol Filters</h3>
                        <div className="flex flex-wrap gap-2">
                            {allProtocols.map(p => (
                                <ProtocolBadge key={p} proto={p} active={activeProtocols.has(p)} onClick={() => toggleProtocol(p)} />
                            ))}
                        </div>
                        {/* Connection Types mini */}
                        <div className="mt-4 pt-3 border-t border-gray-800">
                            <h4 className="text-xs text-gray-500 mb-2">Connection Types</h4>
                            <div className="flex items-center gap-3">
                                {connTypeData.map(ct => (
                                    <div key={ct.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: ct.color }} />
                                        <span className="text-xs text-gray-400">{ct.name}</span>
                                        <span className="text-xs font-mono text-gray-500">{formatNumber(ct.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


            </div>

            {/* ─── Tab Navigation ─── */}
            <div className="flex gap-1 border-b border-gray-800">
                {(['live', 'statistics', 'connections', 'security', 'history', 'dns', 'comparison'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveView(tab)}
                        className={`px-4 py-2 text-xs font-medium capitalize transition-all rounded-t-lg ${activeView === tab
                            ? 'text-cyan-400 bg-gray-900/60 border border-gray-800 border-b-transparent -mb-px'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}>
                        {tab === 'live' ? 'Live Stream' : tab}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ LIVE STREAM ═══════════════════ */}
            {activeView === 'live' && (
                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by IP, port, or protocol..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900/60 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>

                    {/* Live Packet Table */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                        <div ref={logRef} className="h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-900/95 border-b border-gray-800 z-10">
                                    <tr>
                                        <th className="text-left text-gray-500 font-medium px-3 py-2 text-[10px]">TIME</th>
                                        <th className="text-left text-gray-500 font-medium px-3 py-2 text-[10px]">PROTO</th>
                                        <th className="text-left text-gray-500 font-medium px-3 py-2 text-[10px]">SOURCE</th>
                                        <th className="text-center text-gray-500 font-medium px-1 py-2 text-[10px]"></th>
                                        <th className="text-left text-gray-500 font-medium px-3 py-2 text-[10px]">DESTINATION</th>
                                        <th className="text-right text-gray-500 font-medium px-3 py-2 text-[10px]">SIZE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLog.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center text-gray-600 py-12">No packets matching filters</td></tr>
                                    ) : (
                                        filteredLog.map((pkt, i) => (
                                            <tr key={i} className={`border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors ${pkt.suspicious ? 'bg-red-500/5' : ''}`}>
                                                <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">{pkt.time}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                                                        color: PROTO_COLORS[pkt.proto] || '#9ca3af',
                                                        background: `${PROTO_COLORS[pkt.proto] || '#6b7280'}20`
                                                    }}>
                                                        {pkt.proto}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-gray-300 text-[10px]">{pkt.src}</td>
                                                <td className="px-1 py-1.5 text-gray-600 text-center text-[10px]">→</td>
                                                <td className="px-3 py-1.5 font-mono text-gray-300 text-[10px]">{pkt.dst}</td>
                                                <td className="px-3 py-1.5 font-mono text-gray-400 text-[10px] text-right">{pkt.size} B</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ STATISTICS ═══════════════════ */}
            {activeView === 'statistics' && (
                <div className="space-y-6">
                    {/* Row 1: Bandwidth + Latency */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bandwidth Chart */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                            <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" /> Bandwidth Usage
                            </h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={bandwidthData}>
                                        <defs>
                                            <linearGradient id="colorDown2" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorUp2" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                        <XAxis dataKey="timestamp" stroke="#4b5563" fontSize={10} tickCount={5} />
                                        <YAxis stroke="#4b5563" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} />
                                        <Area type="monotone" dataKey="download_bytes" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorDown2)" name="Download" />
                                        <Area type="monotone" dataKey="upload_bytes" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorUp2)" name="Upload" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Latency Chart */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                            <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                <Wifi className="w-4 h-4 text-amber-400" /> Network Latency
                            </h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={latencyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                        <XAxis dataKey="timestamp" stroke="#4b5563" fontSize={10} />
                                        <YAxis stroke="#4b5563" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} />
                                        <Line type="monotone" dataKey="latency_ms" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency (ms)" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Protocol Distribution + Top Devices */}
                    {/* Row 2: Protocol Distribution + Top Devices */}
                    {dashboardConfig.showProtocolCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Protocol Distribution */}
                            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <Server className="w-4 h-4 text-purple-400" /> Protocol Distribution
                                </h3>
                                <div className="h-[250px] flex items-center">
                                    <ResponsiveContainer width="50%" height="100%">
                                        <PieChart>
                                            <Pie data={protocolChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                                paddingAngle={3} dataKey="value" stroke="none">
                                                {protocolChartData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-col gap-1.5 pl-2">
                                        {protocolChartData.map((entry) => (
                                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                                                <span className="text-gray-400 w-12">{entry.name}</span>
                                                <span className="text-gray-500 font-mono">{entry.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Top Devices */}
                            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <Monitor className="w-4 h-4 text-cyan-400" /> Top Devices by Traffic
                                </h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analyticsData.top_devices.map(d => ({
                                            name: d.hostname || d.ip || d.mac.slice(-5),
                                            Download: d.download,
                                            Upload: d.upload
                                        }))} layout="vertical" margin={{ left: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                            <XAxis type="number" stroke="#4b5563" fontSize={10} tickFormatter={(v: number) => formatBytes(v)} />
                                            <YAxis type="category" dataKey="name" stroke="#4b5563" fontSize={11} width={55} />
                                            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }} itemStyle={{ color: '#e5e7eb' }}
                                                formatter={(value: number) => formatBytes(value)} />
                                            <Bar dataKey="Download" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={10} />
                                            <Bar dataKey="Upload" fill="#34d399" radius={[0, 4, 4, 0]} barSize={10} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Row 3: Packet Size Distribution + Bytes per Protocol */}
                    {/* Row 3: Packet Size Distribution + Bytes per Protocol */}
                    {dashboardConfig.showPacketCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Packet Size Distribution */}
                            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-amber-400" /> Packet Size Distribution
                                </h3>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sizeDistData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                            <XAxis type="number" stroke="#4b5563" fontSize={10} tickFormatter={(v: number) => formatNumber(v)} />
                                            <YAxis type="category" dataKey="shortName" stroke="#4b5563" fontSize={10} width={50} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                                                itemStyle={{ color: '#e5e7eb' }}
                                                formatter={(value: number) => value.toLocaleString()}
                                            />
                                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14} name="Packets">
                                                {sizeDistData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Bytes per Protocol */}
                            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-blue-400" /> Traffic Volume by Protocol
                                </h3>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bytesPerProtoData} margin={{ left: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                            <XAxis dataKey="name" stroke="#4b5563" fontSize={10} />
                                            <YAxis stroke="#4b5563" fontSize={10} tickFormatter={(v: number) => formatBytes(v)} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                                                itemStyle={{ color: '#e5e7eb' }}
                                                formatter={(value: number) => formatBytes(value)}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28} name="Bytes">
                                                {bytesPerProtoData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════ CONNECTIONS ═══════════════════ */}
            {activeView === 'connections' && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <h3 className="text-xs font-medium text-white">External Connections</h3>
                        <span className="ml-auto text-xs text-gray-500">{externalConnections.length} destinations</span>
                    </div>
                    <div className="h-[400px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-900/95 border-b border-gray-800">
                                <tr>
                                    <th className="text-left text-gray-500 font-medium px-5 py-3 text-xs">IP ADDRESS</th>
                                    <th className="text-left text-gray-500 font-medium px-5 py-3 text-xs">LOCATION</th>
                                    <th className="text-right text-gray-500 font-medium px-5 py-3 text-xs">HITS</th>
                                    <th className="text-right text-gray-500 font-medium px-5 py-3 text-xs">TRAFFIC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {externalConnections.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center text-gray-600 py-12">No external connections detected yet</td></tr>
                                ) : (
                                    externalConnections.sort((a, b) => b.bytes - a.bytes).map((conn, i) => (
                                        <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors">
                                            <td className="px-5 py-3 font-mono text-gray-300 text-xs">{conn.ip}</td>
                                            <td className="px-5 py-3 text-gray-400 text-xs">
                                                <span className="mr-1">🌍</span> {conn.city}, {conn.country}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-gray-400 text-xs text-right">{conn.hits.toLocaleString()}</td>
                                            <td className="px-5 py-3 font-mono text-cyan-400 text-xs text-right">{formatBytes(conn.bytes)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════════════ SECURITY ═══════════════════ */}
            {activeView === 'security' && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-white">Security Events</h3>
                        <span className="ml-auto text-[10px] text-gray-500">{securityEvents.length} events</span>
                    </div>
                    <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {securityEvents.length === 0 ? (
                            <div className="text-center text-gray-500 py-8 flex flex-col items-center gap-2">
                                <Shield className="w-8 h-8 text-green-500/50" />
                                <span>No security events detected. Safe seas! 🌊</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {securityEvents.map((event) => (
                                    <div key={event.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${event.severity === 'CRITICAL' ? 'text-red-500' :
                                                event.severity === 'HIGH' ? 'text-orange-500' : 'text-yellow-500'
                                                }`} />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-gray-200 text-sm">{event.event_type}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] border border-gray-700 text-gray-500 font-mono">
                                                        {event.source_ip || 'Unknown IP'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">{event.description}</p>
                                                <p className="text-[10px] text-gray-600 mt-1.5">{new Date(event.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${event.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                            event.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {event.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ═══════════════════ HISTORY ═══════════════════ */}
            {activeView === 'history' && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-white">System Network History (24 Hours)</h3>
                    </div>

                    {historyLoading ? (
                        <div className="h-[400px] flex items-center justify-center text-gray-500 animate-pulse">
                            Loading history data...
                        </div>
                    ) : systemHistory.length === 0 ? (
                        <div className="h-[400px] flex items-center justify-center text-gray-500">
                            No history data available yet.
                        </div>
                    ) : (
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={systemHistory}>
                                    <defs>
                                        <linearGradient id="histDown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="histUp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis
                                        dataKey="timestamp"
                                        stroke="#4b5563"
                                        fontSize={10}
                                        tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    />
                                    <YAxis stroke="#4b5563" fontSize={10} tickFormatter={(v) => formatBytes(v)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e5e7eb' }}
                                        labelFormatter={(l) => new Date(l).toLocaleString()}
                                        formatter={(value: number) => formatBytes(value)}
                                    />
                                    <Area type="monotone" dataKey="bytes_recv" name="Download" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#histDown)" />
                                    <Area type="monotone" dataKey="bytes_sent" name="Upload" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#histUp)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════ DNS LOGS ═══════════════════ */}
            {activeView === 'dns' && (
                <DnsQueryLog />
            )}

            {activeView === 'comparison' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <NetworkComparison />
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
