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
    Flag, FileSpreadsheet, FileText
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';
import PredictionWidget from './PredictionWidget';
import YearlyStatsView from './YearlyStatsView';
import TrafficCategoriesWidget from './TrafficCategoriesWidget';
import { NetworkTopology } from './NetworkTopology';
import { RulesModal } from './analytics/RulesModal';
import { cn } from '../lib/utils';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';


// ─── Protocol Color Map ───
const PROTO_COLORS: Record<string, string> = {
    TCP: '#22d3ee',
    UDP: '#34d399',
    HTTP: '#f97316',
    HTTPS: '#3b82f6',
    DNS: '#eab308',
    ICMP: '#0ea5e9',
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
        flags?: string;
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
    lat?: number;
    lon?: number;
}


interface DashboardConfig {
    showStatsRow: boolean;
    showLiveBandwidth: boolean;
    showGauges: boolean;
    showProtocolFilters: boolean;
    showProtocolCharts: boolean;
    showPacketCharts: boolean;
    showTrafficCategories: boolean;
}

// ─── Helper ───
function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatNumber(num?: number): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

// ─── Stat Card ───
const StatCard = ({ label, value, icon: Icon, color, sub, trend }: {
    label: string; value: string | number; icon: React.ElementType; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="panel p-3 rounded-[7px] border border-line bg-panel flex flex-col gap-1 hover:border-line-strong transition-colors">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{label}</span>
            <div className="w-5 h-5 rounded-[4px] flex items-center justify-center bg-raised border border-line">
                <Icon className="h-3 w-3" style={{ color }} />
            </div>
        </div>
        <span className="text-lg font-semibold text-text font-mono num leading-tight">{value}</span>
        {sub && (
            <div className="flex items-center gap-1 font-mono text-[10px] text-text-soft">
                {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-ok" />}
                {trend === 'down' && <TrendingUp className="w-2.5 h-2.5 text-danger rotate-180" />}
                <span className="truncate">{sub}</span>
            </div>
        )}
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
                    <span className="text-[10px] text-muted-foreground">{rate}</span>
                </div>
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
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

export interface HeatmapPoint {
    day: string;
    hour: number;
    value: number;
}

export interface SecurityRule {
    id?: number;
    name: string;
    description: string;
    condition: string;
    action: string;
    is_active: boolean;
}

interface PacketLog {
    time: string;
    proto: string;
    src: string;
    dst: string;
    size: number;
    flags?: string;
    suspicious?: boolean;
}

// ─── MAIN COMPONENT ───
const AnalyticsDashboard = () => {
    const [activeView, setActiveView] = useState<'interfaces' | 'live' | 'statistics' | 'connections' | 'security' | 'history' | 'dns' | 'comparison' | 'topology'>('live');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [bandwidthData, setBandwidthData] = useState<BandwidthPoint[]>([]);
    const [latencyData, setLatencyData] = useState<LatencyPoint[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [externalConnections, setExternalConnections] = useState<ExternalConnection[]>([]);
    const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]); // New state for heatmap
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [rules, setRules] = useState<SecurityRule[]>([]);
    const [editingRule, setEditingRule] = useState<SecurityRule | null>(null);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [packetLogs, setPacketLogs] = useState<PacketLog[]>([]); // New state for packet logs
    const [flagFilter, setFlagFilter] = useState(''); // New state for flag filter
    const [loading, setLoading] = useState(true);
    const [paused, setPaused] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const handleGenerateReport = async (reportType: 'network_summary' | 'security_audit') => {
        setIsGeneratingReport(true);
        try {
            const response = await axiosInstance.get(`/reports/pdf/${reportType}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statsea_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            // toast might not be imported as toast, but sonner is often used as toast.
            // I'll check if toast is imported. It seems sonner is not imported yet, but let me check.
        } catch (error) {
            console.error('Report generation failed:', error);
        } finally {
            setIsGeneratingReport(false);
        }
    };
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
            showPacketCharts: true,
            showTrafficCategories: true
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

    const fetchRules = async () => {
        setRulesLoading(true);
        try {
            const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.SECURITY.RULES);
            setRules(res.data);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        } finally {
            setRulesLoading(false);
        }
    };

    useEffect(() => {
        if (showRulesModal) fetchRules();
    }, [showRulesModal]);

    const handleSaveRule = async (rule: SecurityRule) => {
        try {
            if (rule.id) {
                await axiosInstance.put(`${API_CONFIG.ENDPOINTS.SECURITY.RULES}/${rule.id}`, rule);
            } else {
                await axiosInstance.post(API_CONFIG.ENDPOINTS.SECURITY.RULES, rule);
            }
            fetchRules();
            setEditingRule(null);
        } catch (error) {
            console.error('Failed to save rule:', error);
        }
    };

    const handleDeleteRule = async (id: number) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            await axiosInstance.delete(`${API_CONFIG.ENDPOINTS.SECURITY.RULES}/${id}`);
            fetchRules();
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    };

    const exportToCSV = <T extends object>(data: T[], filename: string) => {
        if (!data || !data.length) return;
        const first = data[0] as Record<string, unknown>;
        const keys = Object.keys(first).filter(k => typeof first[k] !== 'object');
        const csvContent = [
            keys.join(','),
            ...data.map(row => {
                const r = row as Record<string, unknown>;
                return keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleWidget = (key: keyof DashboardConfig) => {
        setDashboardConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
        // Load from cache initially
        const cachedAnalytics = localStorage.getItem('statsea_cache_analytics');
        const cachedBandwidth = localStorage.getItem('statsea_cache_bandwidth');
        const cachedSecurity = localStorage.getItem('statsea_cache_security');
        const cachedExternal = localStorage.getItem('statsea_cache_external');

        if (cachedAnalytics) setAnalyticsData(JSON.parse(cachedAnalytics));
        if (cachedBandwidth) setBandwidthData(JSON.parse(cachedBandwidth));
        if (cachedSecurity) setSecurityEvents(JSON.parse(cachedSecurity));
        if (cachedExternal) setExternalConnections(JSON.parse(cachedExternal));

        const fetchData = async () => {
            if (paused) return;
            try {
                const [analyticsRes, netRes, secRes, connRes, heatmapRes] = await Promise.all([
                    axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.SUMMARY),
                    axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY),
                    axiosInstance.get(API_CONFIG.ENDPOINTS.SECURITY.EVENTS),
                    axiosInstance.get(API_CONFIG.ENDPOINTS.NETWORK.CONNECTIONS),
                    axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.HEATMAP)
                ]);

                setAnalyticsData(analyticsRes.data);
                setHeatmapData(heatmapRes.data);

                const netData = netRes.data || {};
                const rawBandwidth = Array.isArray(netData.bandwidth) ? netData.bandwidth : [];
                const formattedBandwidth = rawBandwidth.map((i: BandwidthPoint) => ({
                    ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                })).reverse();

                setBandwidthData(formattedBandwidth);
                const rawLatency = Array.isArray(netData.latency) ? netData.latency : [];
                setLatencyData(rawLatency.map((i: LatencyPoint) => ({
                    ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                })).reverse());

                setSecurityEvents(Array.isArray(secRes.data) ? secRes.data : []);
                setExternalConnections(Array.isArray(connRes.data) ? connRes.data : []);

                // Update cache
                localStorage.setItem('statsea_cache_analytics', JSON.stringify(analyticsRes.data));
                localStorage.setItem('statsea_cache_bandwidth', JSON.stringify(formattedBandwidth));
                localStorage.setItem('statsea_cache_security', JSON.stringify(Array.isArray(secRes.data) ? secRes.data : []));
                localStorage.setItem('statsea_cache_external', JSON.stringify(Array.isArray(connRes.data) ? connRes.data : []));
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

    // Fetch packet logs separately for live view
    useEffect(() => {
        if (activeView !== 'live' || paused) return;

        const fetchPacketLogs = async () => {
            try {
                const params = new URLSearchParams();
                params.append('limit', '100');

                if (searchQuery) {
                    const q = searchQuery.trim();
                    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(q)) {
                        params.append('ip', q);
                    } else if (/^\d+$/.test(q)) {
                        params.append('port', q);
                    } else {
                        params.append('protocol', q);
                    }
                }

                if (flagFilter) {
                    params.append('flags', flagFilter);
                }

                const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.PACKETS, { params });
                setPacketLogs(res.data);
            } catch (error) {
                console.error("Error fetching packet logs:", error);
            }
        };

        fetchPacketLogs();
        const interval = setInterval(fetchPacketLogs, 1000);
        return () => clearInterval(interval);
    }, [activeView, paused, searchQuery, flagFilter]);


    // Auto-scroll live stream
    useEffect(() => {
        if (logRef.current && activeView === 'live' && !paused) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [analyticsData?.packet_log, activeView, paused]);

    if (loading && !analyticsData) return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground gap-4">
            <Activity className="w-8 h-8 animate-pulse text-cyan-500" />
            <span>Initializing Traffic Analyzer...</span>
        </div>
    );

    if (!analyticsData) return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground gap-4">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <h3 className="text-xl font-semibold text-white">Backend Unavailable</h3>
            <p className="max-w-md text-center text-muted-foreground">
                Could not connect to the analysis engine. Please ensure the backend server is running.
            </p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border"
            >
                Retry Connection
            </button>
        </div>
    );

    const totalTraffic = analyticsData.upload_rate + analyticsData.download_rate;
    const downPct = totalTraffic > 0 ? Math.round((analyticsData.download_rate / totalTraffic) * 100) : 0;
    const upPct = totalTraffic > 0 ? Math.round((analyticsData.upload_rate / totalTraffic) * 100) : 0;

    // Protocol data for pie chart
    const protocolChartData = Object.entries(analyticsData.protocols || {}).map(([name, value]) => ({
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
    const sourceLogs = (activeView === 'live' && packetLogs.length > 0) ? packetLogs : (analyticsData.packet_log || []);
    const filteredLog = sourceLogs.filter(pkt => {
        if (!activeProtocols.has(pkt.proto)) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!(pkt.src.toLowerCase().includes(q) || pkt.dst.toLowerCase().includes(q) || pkt.proto.toLowerCase().includes(q))) return false;
        }
        if (flagFilter) {
            const f = flagFilter.toUpperCase();
            if (!pkt.flags || !pkt.flags.includes(f)) return false;
        }
        return true;
    });

    const allProtocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'SSH', 'FTP'];

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
                            <h1 className="text-base font-semibold text-text tracking-tight">Traffic Analyzer</h1>
                            <span className={cn(
                                "status text-[10px] uppercase font-mono px-2 py-0.5",
                                paused ? "warn" : "ok"
                            )}>
                                {paused ? 'PAUSED' : 'LIVE CAPTURE'}
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">Real-time packet inspection & telemetry engine</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setPaused(!paused)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-xs font-mono transition-colors border",
                            paused
                                ? "bg-raised border-line text-ok hover:bg-line-strong"
                                : "bg-raised border-line text-warn hover:bg-line-strong"
                        )}>
                        {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
                    </button>
                    <button
                        onClick={() => handleGenerateReport('network_summary')}
                        disabled={isGeneratingReport}
                        aria-label="Generate network summary report"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-raised hover:bg-line-strong text-text-soft hover:text-text border border-line rounded-[7px] text-xs font-mono transition-colors disabled:opacity-50"
                    >
                        {isGeneratingReport ? (
                            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <FileText className="w-3.5 h-3.5 text-accent" />
                        )}
                        REPORT
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            aria-label="Dashboard settings"
                            className={cn(
                                "p-1.5 rounded-[7px] transition-colors border",
                                showSettings ? "bg-raised border-line-strong text-accent" : "bg-panel border-line text-text-soft hover:text-text"
                            )}
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Settings Dropdown */}
                        {showSettings && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-panel border border-line-strong rounded-[7px] shadow-lg z-50 p-2 font-mono text-xs">
                                <div className="text-[10px] text-faint uppercase tracking-wider mb-2 px-1">Layout Sections</div>
                                <div className="space-y-1">
                                    {[
                                        { key: 'showStatsRow', label: 'Key Statistics' },
                                        { key: 'showLiveBandwidth', label: 'Bandwidth Graph' },
                                        { key: 'showGauges', label: 'Network Gauges' },
                                        { key: 'showProtocolFilters', label: 'Protocol Filters' },
                                        { key: 'showProtocolCharts', label: 'Protocol Distribution' },
                                        { key: 'showPacketCharts', label: 'Packet Volume' },
                                    ].map(item => (
                                        <button
                                            key={item.key}
                                            onClick={() => toggleWidget(item.key as keyof DashboardConfig)}
                                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-raised rounded-[5px] text-xs text-text transition-colors"
                                        >
                                            <span>{item.label}</span>
                                            <span className={cn(
                                                "status text-[9px] uppercase px-1 py-0.2",
                                                dashboardConfig[item.key as keyof DashboardConfig] ? "ok" : "warn"
                                            )}>
                                                {dashboardConfig[item.key as keyof DashboardConfig] ? 'ON' : 'OFF'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Totals Strip */}
            <div className="panel strip">
                <div className="cell">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono text-faint">Total Packets</span>
                        <Zap className="w-3 h-3 text-accent" />
                    </div>
                    <div className="num text-base font-semibold text-text mt-1">
                        {analyticsData?.total_packets.toLocaleString() || '---'}
                    </div>
                </div>
                <div className="cell">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono text-faint">Total Bytes</span>
                        <Database className="w-3 h-3 text-upload" />
                    </div>
                    <div className="num text-base font-semibold text-text mt-1">
                        {analyticsData ? formatBytes(analyticsData.total_bytes) : '---'}
                    </div>
                </div>
                <div className="cell">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono text-faint">Active Conns</span>
                        <Network className="w-3 h-3 text-ok" />
                    </div>
                    <div className="num text-base font-semibold text-text mt-1">
                        {externalConnections.length.toLocaleString()}
                    </div>
                </div>
                <div className="cell">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono text-faint">Security Events</span>
                        <AlertTriangle className="w-3 h-3 text-warn" />
                    </div>
                    <div className="num text-base font-semibold text-text mt-1">
                        {securityEvents.length}
                    </div>
                </div>
            </div>

            {/* AI Predictions & Anomalies */}
            <PredictionWidget />

            {/* ─── Stats Row (8 cards) ─── */}
            {dashboardConfig.showStatsRow && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <StatCard label="Packets" value={formatNumber(analyticsData.total_packets)} icon={Zap} color="#22d3ee" sub="total captured" />
                    <StatCard label="Data" value={formatBytes(analyticsData.total_bytes)} icon={Database} color="#34d399" sub="transferred" />
                    <StatCard label="PPS" value={`${analyticsData.packets_per_sec}`} icon={Activity} color="#06b6d4" sub="packets/sec" trend="up" />
                    <StatCard label="Suspicious" value={analyticsData.suspicious} icon={AlertTriangle} color={analyticsData.suspicious > 0 ? '#f43f5e' : '#6b7280'} sub="flagged" trend={analyticsData.suspicious > 0 ? 'up' : 'neutral'} />
                    <StatCard label="DNS" value={formatNumber(analyticsData.dns_queries)} icon={Globe} color="#eab308" sub="queries" />
                    <StatCard label="HTTP" value={formatNumber(analyticsData.http_requests)} icon={Network} color="#f97316" sub="requests" />
                    <StatCard label="Sessions" value={analyticsData.active_sessions} icon={Radio} color="#14b8a6" sub="active" trend="up" />
                    <StatCard label="Devices" value={analyticsData.active_device_count} icon={Monitor} color="#0284c7" sub="online" />
                </div>
            )}

            {/* ─── Live Bandwidth Timeline + Gauges + Protocol Filters ─── */}
            <div className={`grid grid-cols-1 ${dashboardConfig.showLiveBandwidth && dashboardConfig.showGauges && dashboardConfig.showProtocolFilters ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
                {/* Live Bandwidth Timeline */}
                {dashboardConfig.showLiveBandwidth && (
                    <div className="panel p-4 rounded-[var(--r-panel)]">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text mb-2 flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-accent" /> Live Bandwidth
                        </h3>
                        <div className="h-[100px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analyticsData.bandwidth_history || []}>
                                    <defs>
                                        <linearGradient id="liveDown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--upload)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--upload)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="liveUp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--ok)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--ok)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="var(--faint)" fontSize={9} tickCount={4} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--faint)" fontSize={9} tickFormatter={(v: number) => formatBytes(v)} width={50} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line-strong)', borderRadius: '7px', fontSize: '11px', color: 'var(--text)' }}
                                        itemStyle={{ color: 'var(--text)' }}
                                        formatter={(value: number) => formatBytes(value)}
                                    />
                                    <Area type="monotone" dataKey="down" stroke="var(--upload)" strokeWidth={1.5} fill="url(#liveDown)" dot={false} name="Download" />
                                    <Area type="monotone" dataKey="up" stroke="var(--ok)" strokeWidth={1.5} fill="url(#liveUp)" dot={false} name="Upload" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Gauges */}
                {dashboardConfig.showGauges && (
                    <div className="panel p-4 rounded-[var(--r-panel)] flex items-center justify-center gap-6">
                        <CircularGauge percentage={downPct} rate={formatBytes(analyticsData.download_rate) + '/s'} label="Download" color="var(--upload)" dotColor="var(--upload)" />
                        <CircularGauge percentage={upPct} rate={formatBytes(analyticsData.upload_rate) + '/s'} label="Upload" color="var(--ok)" dotColor="var(--ok)" />
                    </div>
                )}

                {/* Protocol Filters */}
                {dashboardConfig.showProtocolFilters && (
                    <div className="panel p-4 rounded-[var(--r-panel)]">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-text mb-2">Protocol Filters</h3>
                        <div className="flex flex-wrap gap-2">
                            {allProtocols.map(p => (
                                <ProtocolBadge key={p} proto={p} active={activeProtocols.has(p)} onClick={() => toggleProtocol(p)} />
                            ))}
                        </div>
                        {/* Connection Types mini */}
                        <div className="mt-4 pt-3 border-t border-line">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-faint mb-2">Connection Types</h4>
                            <div className="flex items-center gap-3">
                                {connTypeData.map(ct => (
                                    <div key={ct.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: ct.color }} />
                                        <span className="text-xs text-text-soft">{ct.name}</span>
                                        <span className="text-xs font-mono text-faint">{formatNumber(ct.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


            </div>

            {/* ─── Tab Navigation ─── */}
            <div className="flex gap-1 border-b border-line">
                {(['interfaces', 'live', 'statistics', 'topology', 'connections', 'security', 'history', 'dns', 'comparison'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveView(tab)}
                        className={`px-4 py-2 text-xs font-mono font-medium capitalize transition-all rounded-t-[7px] ${activeView === tab
                            ? 'text-accent bg-panel border border-line border-b-transparent -mb-px'
                            : 'text-text-soft hover:text-text'
                            }`}>
                        {tab === 'live' ? 'Live Stream' : tab}
                    </button>
                ))}
            </div>

            {/* ═══════════════════ TOPOLOGY TAB ═══════════════════ */}
            {activeView === 'topology' && (
                <div className="space-y-4">
                    <NetworkTopology />
                </div>
            )}

            {/* ═══════════════════ INTERFACES TAB ═══════════════════ */}
            {activeView === 'interfaces' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-text">Network Interfaces</h2>
                        </div>
                        <button
                            onClick={() => {
                                const interfaces = [
                                    { name: 'eth0', status: 'up', type: 'Ethernet', ip: '192.168.1.100', tx: 3450000000, rx: 8920000000 },
                                    { name: 'wlan0', status: 'up', type: 'Wi-Fi', ip: '192.168.1.101', tx: 1200000000, rx: 4500000000 },
                                    { name: 'docker0', status: 'up', type: 'Virtual', ip: '172.17.0.1', tx: 56000000, rx: 89000000 },
                                    { name: 'tun0', status: 'down', type: 'VPN', ip: '-', tx: 0, rx: 0 },
                                ];
                                exportToCSV(interfaces, 'interfaces');
                            }}
                            className="px-2.5 py-1 bg-raised hover:bg-line-strong text-text-soft hover:text-text border border-line rounded-[7px] flex items-center gap-1.5 text-xs font-mono transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-ok" /> Export CSV
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { name: 'eth0', status: 'up', type: 'Ethernet', ip: '192.168.1.100', tx: 3450000000, rx: 8920000000, history: [10, 25, 15, 40, 30, 60, 45, 80, 50, 20] },
                            { name: 'wlan0', status: 'up', type: 'Wi-Fi', ip: '192.168.1.101', tx: 1200000000, rx: 4500000000, history: [5, 12, 8, 20, 15, 30, 22, 40, 25, 10] },
                            { name: 'docker0', status: 'up', type: 'Virtual', ip: '172.17.0.1', tx: 56000000, rx: 89000000, history: [1, 5, 2, 8, 4, 15, 8, 20, 10, 3] },
                            { name: 'tun0', status: 'down', type: 'VPN', ip: '-', tx: 0, rx: 0, history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                        ].map((iface) => (
                            <div key={iface.name} className="panel p-4 rounded-[var(--r-panel)] border border-line bg-panel flex flex-col relative overflow-hidden group hover:border-line-strong transition-colors cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-ok' : 'bg-danger'} ${iface.status === 'up' ? 'animate-pulse' : ''}`} />
                                        <h3 className="text-xs font-semibold font-mono text-text">{iface.name}</h3>
                                    </div>
                                    <span className="text-[10px] uppercase font-mono tracking-wider text-faint bg-raised px-2 py-0.5 rounded-[4px] border border-line">{iface.type}</span>
                                </div>

                                <div className="space-y-2 mb-4 font-mono">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-faint">IP Address</span>
                                        <span className="text-text">{iface.ip}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-faint">Total RX</span>
                                        <span className="text-upload num">{formatBytes(iface.rx)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-faint">Total TX</span>
                                        <span className="text-ok num">{formatBytes(iface.tx)}</span>
                                    </div>
                                </div>

                                <div className="mt-auto h-12 w-full pt-2 border-t border-line">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={iface.history.map((val, i) => ({ time: i, value: val }))}>
                                            <defs>
                                                <linearGradient id={`grad-${iface.name}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={iface.status === 'up' ? "var(--upload)" : "var(--faint)"} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={iface.status === 'up' ? "var(--upload)" : "var(--faint)"} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="value" stroke={iface.status === 'up' ? "var(--upload)" : "var(--faint)"} strokeWidth={1.5} fill={`url(#grad-${iface.name})`} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════════════ LIVE STREAM ═══════════════════ */}
            {activeView === 'live' && (
                <div className="space-y-4">
                    {/* Search and Filters */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                            <input
                                type="text"
                                placeholder="Search by IP, port, or protocol..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-raised border border-line rounded-[7px] pl-9 pr-4 py-1.5 text-xs font-mono text-text placeholder-faint focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <div className="relative w-48">
                            <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                            <input
                                type="text"
                                placeholder="Filter Flags (e.g. syn)"
                                value={flagFilter}
                                onChange={e => setFlagFilter(e.target.value)}
                                className="w-full bg-raised border border-line rounded-[7px] pl-9 pr-4 py-1.5 text-xs font-mono text-text placeholder-faint focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <button
                            onClick={() => exportToCSV(filteredLog, 'live_traffic')}
                            className="px-3 py-1.5 bg-raised border border-line rounded-[7px] hover:bg-line-strong flex items-center gap-1.5 text-xs font-mono text-text-soft hover:text-text transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-ok" /> Export CSV
                        </button>
                    </div>

                    {/* Live Packet Table */}
                    <div className="panel p-0 rounded-[var(--r-panel)] border border-line bg-panel overflow-hidden">
                        <div ref={logRef} className="h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-raised/90 backdrop-blur-xs border-b border-line z-10">
                                    <tr>
                                        <th className="text-left text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">TIME</th>
                                        <th className="text-left text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">PROTO</th>
                                        <th className="text-left text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">FLAGS</th>
                                        <th className="text-left text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">SOURCE</th>
                                        <th className="text-center text-faint font-mono font-medium px-1 py-2 text-[10px]"></th>
                                        <th className="text-left text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">DESTINATION</th>
                                        <th className="text-right text-faint font-mono font-medium px-3 py-2 text-[10px] uppercase">SIZE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLog.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center text-text-soft font-mono py-12 text-xs">No packets matching filters</td></tr>
                                    ) : (
                                        filteredLog.map((pkt, i) => (
                                            <tr key={i} className={`border-b border-line hover:bg-raised/60 transition-colors ${pkt.suspicious ? 'bg-danger/10' : ''}`}>
                                                <td className="px-3 py-1.5 font-mono text-faint text-[10px]">{pkt.time}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono" style={{
                                                        color: PROTO_COLORS[pkt.proto] || '#9ca3af',
                                                        background: `${PROTO_COLORS[pkt.proto] || '#6b7280'}20`
                                                    }}>
                                                        {pkt.proto}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-faint text-[10px]">
                                                    {pkt.flags && pkt.flags !== 'None' ? (
                                                        <span className="text-xs text-upload font-mono">{pkt.flags}</span>
                                                    ) : (
                                                        <span className="text-faint/40">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-text text-[10px]">{pkt.src}</td>
                                                <td className="px-1 py-1.5 text-faint text-center text-[10px]">→</td>
                                                <td className="px-3 py-1.5 font-mono text-text text-[10px]">{pkt.dst}</td>
                                                <td className="px-3 py-1.5 font-mono text-faint text-[10px] text-right num">{pkt.size} B</td>
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
                        <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                            <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                <Activity className="w-4 h-4 text-ok" /> Bandwidth Usage
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
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                        <XAxis dataKey="timestamp" stroke="var(--faint)" fontSize={10} tickCount={5} />
                                        <YAxis stroke="var(--faint)" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text)' }} />
                                        <Area type="monotone" dataKey="download_bytes" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorDown2)" name="Download" />
                                        <Area type="monotone" dataKey="upload_bytes" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorUp2)" name="Upload" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Latency Chart */}
                        <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                            <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                <Wifi className="w-4 h-4 text-warn" /> Network Latency
                            </h3>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={latencyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                        <XAxis dataKey="timestamp" stroke="var(--faint)" fontSize={10} />
                                        <YAxis stroke="var(--faint)" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text)' }} />
                                        <Line type="monotone" dataKey="latency_ms" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency (ms)" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Protocol Distribution + Top Devices Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-text flex items-center gap-2 font-mono">
                            <BarChart3 className="w-4 h-4 text-accent" /> Traffic Statistics
                        </h2>
                        <button
                            onClick={() => exportToCSV(
                                Object.entries(analyticsData.protocols).map(([p, v]) => ({ Protocol: p, Packets: v, Bytes: analyticsData.bytes_per_protocol?.[p] || 0 })),
                                'statistics'
                            )}
                            className="px-3 py-1.5 bg-raised border border-line rounded-[7px] hover:border-line-strong hover:bg-panel flex items-center gap-1.5 text-xs font-mono text-text-soft transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-ok" /> Export CSV
                        </button>
                    </div>

                    {dashboardConfig.showProtocolCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Protocol Distribution */}
                            <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                                <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                    <Server className="w-4 h-4 text-accent" /> Protocol Distribution
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
                                            <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-col gap-1.5 pl-2">
                                        {protocolChartData.map((entry) => (
                                            <div key={entry.name} className="flex items-center gap-2 text-xs font-mono">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                                                <span className="text-text-soft w-12">{entry.name}</span>
                                                <span className="text-faint num">{entry.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Top Devices */}
                            <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                                <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                    <Monitor className="w-4 h-4 text-accent" /> Top Devices by Traffic
                                </h3>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analyticsData.top_devices.map(d => ({
                                            name: d.hostname || d.ip || d.mac.slice(-5),
                                            Download: d.download,
                                            Upload: d.upload
                                        }))} layout="vertical" margin={{ left: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                            <XAxis type="number" stroke="var(--faint)" fontSize={10} tickFormatter={(v: number) => formatBytes(v)} />
                                            <YAxis type="category" dataKey="name" stroke="var(--faint)" fontSize={11} width={55} />
                                            <Tooltip contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text)' }}
                                                formatter={(value: number) => formatBytes(value)} />
                                            <Bar dataKey="Download" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={10} />
                                            <Bar dataKey="Upload" fill="#34d399" radius={[0, 4, 4, 0]} barSize={10} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {dashboardConfig.showPacketCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Packet Size Distribution */}
                            <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                                <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                    <Layers className="w-4 h-4 text-warn" /> Packet Size Distribution
                                </h3>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sizeDistData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                            <XAxis type="number" stroke="var(--faint)" fontSize={10} tickFormatter={(v: number) => formatNumber(v)} />
                                            <YAxis type="category" dataKey="shortName" stroke="var(--faint)" fontSize={10} width={50} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }}
                                                itemStyle={{ color: 'var(--text)' }}
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
                            <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                                <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                                    <BarChart3 className="w-4 h-4 text-accent" /> Traffic Volume by Protocol
                                </h3>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={bytesPerProtoData} margin={{ left: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                            <XAxis dataKey="name" stroke="var(--faint)" fontSize={10} />
                                            <YAxis stroke="var(--faint)" fontSize={10} tickFormatter={(v: number) => formatBytes(v)} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px' }}
                                                itemStyle={{ color: 'var(--text)' }}
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

                    {/* Application Traffic Categories */}
                    {dashboardConfig.showTrafficCategories && (
                        <div className="grid grid-cols-1 gap-6">
                            <TrafficCategoriesWidget />
                        </div>
                    )}

                    {/* 7x24 Traffic Heatmap */}
                    <div className="panel p-3 md:p-4 rounded-[var(--r-panel)] border border-line bg-panel mt-6">
                        <h3 className="text-xs font-medium text-faint mb-3 flex items-center gap-2 font-mono">
                            <Activity className="w-4 h-4 text-accent" /> 7×24 Traffic Heatmap (Volume)
                        </h3>
                        <div className="grid grid-cols-[auto_1fr] gap-2 lg:gap-4 overflow-x-auto custom-scrollbar pb-2">
                            {/* Days Column */}
                            <div className="flex flex-col gap-1 pr-2 border-r border-line justify-between py-1 mt-5">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="text-[10px] text-faint font-medium h-4 sm:h-6 flex items-center font-mono">{d}</div>
                                ))}
                            </div>

                            {/* Heatmap Grid */}
                            <div className="min-w-[600px]">
                                <div className="grid grid-cols-24 gap-1 mb-2" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                    {[...Array(24)].map((_, i) => (
                                        <div key={i} className="text-[9px] text-faint/60 text-center font-mono">{i}</div>
                                    ))}
                                </div>
                                <div className="flex flex-col gap-1 justify-between">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <div key={day} className="grid grid-cols-24 gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                            {[...Array(24)].map((_, h) => {
                                                const datum = heatmapData?.find(d => d.day === day && d.hour === h);
                                                const val = datum?.value || 0;
                                                const maxVal = Math.max(...(heatmapData?.map(d => d.value) || [1]));
                                                const normalized = maxVal > 0 ? val / maxVal : 0;
                                                const opacity = Math.max(0.05, normalized);
                                                return (
                                                    <div
                                                        key={`${day}-${h}`}
                                                        title={`${day} ${h}:00 - ${formatBytes(val)}`}
                                                        className="h-4 sm:h-6 rounded-[2px] cursor-pointer hover:ring-1 hover:ring-accent transition-all duration-200 group relative"
                                                        style={{ backgroundColor: `rgba(34, 211, 238, ${opacity})` }}
                                                    >
                                                        {val > 0 && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-raised text-text text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 z-10 pointer-events-none whitespace-nowrap shadow-xl border border-line font-mono">
                                                            {formatBytes(val)}
                                                        </span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ CONNECTIONS ═══════════════════ */}
            {activeView === 'connections' && (
                <div className="space-y-4">
                    {/* GeoIP World Map */}
                    <div className="panel p-4 rounded-[var(--r-panel)] border border-line bg-panel w-full relative overflow-hidden">
                        <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
                            <h3 className="text-sm font-semibold text-text flex items-center gap-2 font-mono">
                                <Globe className="w-4 h-4 text-accent" /> Global Threat Map
                            </h3>
                            <span className="text-xs text-faint mt-1 font-mono">{externalConnections.length} Active Connections</span>
                        </div>

                        <div className="w-full h-[350px] bg-raised rounded-lg border border-line mt-8 mb-2 flex items-center justify-center relative shadow-inner">
                            {/* Radar scan effect overlay */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.03)_0%,_transparent_70%)] pointer-events-none"></div>

                            <ComposableMap
                                projection="geoMercator"
                                projectionConfig={{
                                    scale: 120,
                                    center: [0, 20]
                                }}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                }}
                            >
                                <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                                    {({ geographies }) =>
                                        geographies.map((geo) => (
                                            <Geography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                fill="var(--raised)"
                                                stroke="var(--line-strong)"
                                                strokeWidth={0.5}
                                                style={{
                                                    default: { outline: "none" },
                                                    hover: { fill: "var(--line-strong)", outline: "none" },
                                                    pressed: { outline: "none" },
                                                }}
                                            />
                                        ))
                                    }
                                </Geographies>
                                {externalConnections.map((conn, idx) => {
                                    if (!conn.lon || !conn.lat) return null;
                                    let lon = conn.lon;
                                    let lat = conn.lat;

                                    // Add minor jitter so dots don't fully overlap
                                    lon += (idx % 10 - 5) * 1.5;
                                    lat += (idx % 8 - 4) * 1.5;

                                    return (
                                        <Marker key={idx} coordinates={[lon, lat]}>
                                            <circle r={conn.hits > 500 ? 5 : 3} fill="#22d3ee" fillOpacity={0.7} className="animate-pulse" />
                                            <circle r={conn.hits > 500 ? 12 : 8} fill="#22d3ee" fillOpacity={0.2} className="animate-ping" style={{ animationDuration: '3s' }} />
                                        </Marker>
                                    );
                                })}
                            </ComposableMap>
                        </div>
                    </div>

                    <div className="panel rounded-[var(--r-panel)] border border-line bg-panel overflow-hidden mt-6">
                        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-accent" />
                                <h3 className="text-xs font-medium text-text font-mono">Connection Details</h3>
                            </div>
                            <button
                                onClick={() => exportToCSV(externalConnections, 'connections')}
                                className="px-3 py-1 bg-raised border border-line rounded-[7px] hover:border-line-strong hover:bg-panel flex items-center gap-1.5 text-xs font-mono text-text-soft transition-colors ml-auto"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-ok" /> Export CSV
                            </button>
                        </div>
                        <div className="h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-raised/95 border-b border-line">
                                    <tr>
                                        <th className="text-left text-faint font-mono font-medium px-4 py-2 text-[10px] uppercase">IP ADDRESS</th>
                                        <th className="text-left text-faint font-mono font-medium px-4 py-2 text-[10px] uppercase">LOCATION</th>
                                        <th className="text-right text-faint font-mono font-medium px-4 py-2 text-[10px] uppercase">HITS</th>
                                        <th className="text-right text-faint font-mono font-medium px-4 py-2 text-[10px] uppercase">TRAFFIC</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {externalConnections.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center text-faint font-mono py-12 text-xs">No external connections detected yet</td></tr>
                                    ) : (
                                        externalConnections.sort((a, b) => b.bytes - a.bytes).map((conn, i) => (
                                            <tr key={i} className="border-b border-line hover:bg-raised/60 transition-colors">
                                                <td className="px-4 py-2 font-mono text-text text-xs">{conn.ip}</td>
                                                <td className="px-4 py-2 text-text-soft text-xs">
                                                    <span className="mr-1">🌍</span> {conn.city}, {conn.country}
                                                </td>
                                                <td className="px-4 py-2 font-mono text-faint text-xs text-right num">{conn.hits.toLocaleString()}</td>
                                                <td className="px-4 py-2 font-mono text-upload text-xs text-right num">{formatBytes(conn.bytes)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ SECURITY ═══════════════════ */}
            {activeView === 'security' && (
                <div className="panel p-4 rounded-[var(--r-panel)] border border-line bg-panel">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-accent" />
                        <h3 className="text-sm font-semibold text-text font-mono">Security Events</h3>
                        <span className="ml-auto text-[10px] text-faint font-mono">{securityEvents.length} events</span>
                        <button
                            onClick={() => exportToCSV(securityEvents, 'security_events')}
                            className="ml-2 px-3 py-1 bg-raised border border-line rounded-[7px] hover:border-line-strong hover:bg-panel flex items-center gap-1.5 text-xs font-mono text-text-soft transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-ok" /> Export CSV
                        </button>
                        <button onClick={() => setShowRulesModal(true)} className="ml-2 px-2.5 py-1 bg-accent-soft text-accent hover:opacity-80 rounded-[7px] text-xs font-mono font-medium transition-opacity flex items-center gap-1">
                            <Settings className="w-3 h-3" /> Configure Rules
                        </button>
                    </div>
                    <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {securityEvents.length === 0 ? (
                            <div className="text-center text-faint py-8 flex flex-col items-center gap-2 font-mono text-xs">
                                <Shield className="w-8 h-8 text-ok opacity-60" />
                                <span>No security events detected. Safe seas! 🌊</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {securityEvents.map((event) => (
                                    <div key={event.id} className="flex items-start justify-between p-3 rounded-lg bg-raised border border-line hover:border-line-strong transition-colors">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${event.severity === 'CRITICAL' ? 'text-danger' :
                                                event.severity === 'HIGH' ? 'text-warn' : 'text-accent'
                                                }`} />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-text text-xs font-mono">{event.event_type}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] border border-line text-faint font-mono">
                                                        {event.source_ip || 'Unknown IP'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-soft mt-1">{event.description}</p>
                                                <p className="text-[10px] text-faint mt-1.5 font-mono">{new Date(event.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono flex-shrink-0 ${event.severity === 'CRITICAL' ? 'bg-danger/20 text-danger' :
                                            event.severity === 'HIGH' ? 'bg-warn/20 text-warn' :
                                                'bg-accent-soft text-accent'
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
                <YearlyStatsView />
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

            {/* Configure Rules Modal */}
            <RulesModal
                isOpen={showRulesModal}
                onClose={() => { setShowRulesModal(false); setEditingRule(null); }}
                rules={rules}
                rulesLoading={rulesLoading}
                editingRule={editingRule}
                setEditingRule={setEditingRule}
                onSaveRule={handleSaveRule}
                onDeleteRule={handleDeleteRule}
            />
        </div>
    );
};

export default AnalyticsDashboard;
