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
    Flag, Plus, Trash2, X, Save, FileSpreadsheet, FileText
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';
import PredictionWidget from './PredictionWidget';
import YearlyStatsView from './YearlyStatsView';
import TrafficCategoriesWidget from './TrafficCategoriesWidget';
import { NetworkTopology } from './NetworkTopology';


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
    label: string; value: string | number; icon: React.ElementType; color: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="bg-card/60 border border-border rounded-xl p-3 flex flex-col gap-0.5 relative overflow-hidden group hover:border-border/80 transition-all duration-300 hover:shadow-lg" style={{ '--glow': color } as React.CSSProperties}>
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${color}15` }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>
        </div>
        <span className="text-xl font-bold text-white font-mono leading-tight">{value}</span>
        {sub && (
            <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />}
                {trend === 'down' && <TrendingUp className="w-2.5 h-2.5 text-red-400 rotate-180" />}
                <span className="text-[10px] text-muted-foreground truncate">{sub}</span>
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


import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

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

    const exportToCSV = (data: any[], filename: string) => {
        if (!data || !data.length) return;
        const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
        const csvContent = [
            keys.join(','),
            ...data.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))
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

                const netData = netRes.data;
                const formattedBandwidth = netData.bandwidth.map((i: BandwidthPoint) => ({
                    ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                })).reverse();

                setBandwidthData(formattedBandwidth);
                setLatencyData(netData.latency.map((i: LatencyPoint) => ({
                    ...i, timestamp: new Date(i.timestamp).toLocaleTimeString()
                })).reverse());

                setSecurityEvents(secRes.data);
                setExternalConnections(connRes.data);

                // Update cache
                localStorage.setItem('statsea_cache_analytics', JSON.stringify(analyticsRes.data));
                localStorage.setItem('statsea_cache_bandwidth', JSON.stringify(formattedBandwidth));
                localStorage.setItem('statsea_cache_security', JSON.stringify(secRes.data));
                localStorage.setItem('statsea_cache_external', JSON.stringify(connRes.data));
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
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Activity className="w-7 h-7 text-cyan-400" />
                        Traffic Analyzer
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-xs">Real-time packet monitoring and deep analysis</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-card/60 border border-border rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                        <span className="text-xs text-muted-foreground">{paused ? 'Paused' : 'Capturing'}</span>
                    </div>
                    <button onClick={() => setPaused(!paused)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${paused
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                            }`}>
                        {paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
                    </button>
                    <button
                        onClick={() => handleGenerateReport('network_summary')}
                        disabled={isGeneratingReport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-medium hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                    >
                        {isGeneratingReport ? (
                            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <FileText className="w-3.5 h-3.5" />
                        )}
                        REPORT
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-secondary border-border text-cyan-400' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground'}`}
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {/* Settings Dropdown */}
                        {showSettings && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Dashboard Layout</h4>
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
                                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-secondary rounded-lg text-xs text-foreground/80 transition-colors"
                                        >
                                            <span>{item.label}</span>
                                            <div className={`w-8 h-4 rounded-full relative transition-colors ${dashboardConfig[item.key as keyof DashboardConfig] ? 'bg-cyan-500/20' : 'bg-secondary'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${dashboardConfig[item.key as keyof DashboardConfig] ? 'left-4.5 bg-cyan-400' : 'left-0.5 bg-muted-foreground'}`} style={{ left: dashboardConfig[item.key as keyof DashboardConfig] ? '18px' : '2px' }} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Real-time Totals Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-card/40 border border-border/60 rounded-xl p-3 shadow-inner my-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Packets</p>
                        <p className="font-mono text-sm text-foreground/90 mt-0.5">{analyticsData?.total_packets.toLocaleString() || '---'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-l border-border/60 pl-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Database className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Bytes</p>
                        <p className="font-mono text-sm text-foreground/90 mt-0.5">{analyticsData ? formatBytes(analyticsData.total_bytes) : '---'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-l border-border/60 pl-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Network className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Connections</p>
                        <p className="font-mono text-sm text-foreground/90 mt-0.5">{externalConnections.length.toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-l border-border/60 pl-4">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Security Events</p>
                        <p className="font-mono text-sm text-foreground/90 mt-0.5">{securityEvents.length}</p>
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
                    <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                        <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
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
                    <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4 flex items-center justify-center gap-6">
                        <CircularGauge percentage={downPct} rate={formatBytes(analyticsData.download_rate) + '/s'} label="Download" color="#22d3ee" dotColor="#22d3ee" />
                        <CircularGauge percentage={upPct} rate={formatBytes(analyticsData.upload_rate) + '/s'} label="Upload" color="#34d399" dotColor="#34d399" />
                    </div>
                )}

                {/* Protocol Filters */}
                {dashboardConfig.showProtocolFilters && (
                    <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">Protocol Filters</h3>
                        <div className="flex flex-wrap gap-2">
                            {allProtocols.map(p => (
                                <ProtocolBadge key={p} proto={p} active={activeProtocols.has(p)} onClick={() => toggleProtocol(p)} />
                            ))}
                        </div>
                        {/* Connection Types mini */}
                        <div className="mt-4 pt-3 border-t border-border">
                            <h4 className="text-xs text-muted-foreground mb-2">Connection Types</h4>
                            <div className="flex items-center gap-3">
                                {connTypeData.map(ct => (
                                    <div key={ct.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: ct.color }} />
                                        <span className="text-xs text-muted-foreground">{ct.name}</span>
                                        <span className="text-xs font-mono text-muted-foreground">{formatNumber(ct.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}


            </div>

            {/* ─── Tab Navigation ─── */}
            <div className="flex gap-1 border-b border-border">
                {(['interfaces', 'live', 'statistics', 'topology', 'connections', 'security', 'history', 'dns', 'comparison'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveView(tab)}
                        className={`px-4 py-2 text-xs font-medium capitalize transition-all rounded-t-lg ${activeView === tab
                            ? 'text-cyan-400 bg-card/60 border border-border border-b-transparent -mb-px'
                            : 'text-muted-foreground hover:text-foreground/80'
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
                            <Activity className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-semibold text-white">Network Interfaces</h2>
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
                            className="px-3 py-1.5 bg-card/60 border border-border rounded-lg hover:border-border/80 hover:bg-secondary flex items-center gap-2 text-xs text-foreground/80 transition-colors"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { name: 'eth0', status: 'up', type: 'Ethernet', ip: '192.168.1.100', tx: 3450000000, rx: 8920000000, history: [10, 25, 15, 40, 30, 60, 45, 80, 50, 20] },
                            { name: 'wlan0', status: 'up', type: 'Wi-Fi', ip: '192.168.1.101', tx: 1200000000, rx: 4500000000, history: [5, 12, 8, 20, 15, 30, 22, 40, 25, 10] },
                            { name: 'docker0', status: 'up', type: 'Virtual', ip: '172.17.0.1', tx: 56000000, rx: 89000000, history: [1, 5, 2, 8, 4, 15, 8, 20, 10, 3] },
                            { name: 'tun0', status: 'down', type: 'VPN', ip: '-', tx: 0, rx: 0, history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                        ].map((iface) => (
                            <div key={iface.name} className="bg-card/60 border border-border rounded-xl p-4 flex flex-col relative overflow-hidden group hover:border-cyan-500/30 transition-colors cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-green-500' : 'bg-red-500'} ${iface.status === 'up' ? 'animate-pulse' : ''}`} />
                                        <h3 className="text-sm font-semibold text-foreground/90">{iface.name}</h3>
                                    </div>
                                    <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{iface.type}</span>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">IP Address</span>
                                        <span className="text-foreground/80 font-mono">{iface.ip}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Total RX</span>
                                        <span className="text-cyan-400 font-mono">{formatBytes(iface.rx)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Total TX</span>
                                        <span className="text-purple-400 font-mono">{formatBytes(iface.tx)}</span>
                                    </div>
                                </div>

                                <div className="mt-auto h-12 w-full pt-2 border-t border-border/50">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={iface.history.map((val, i) => ({ time: i, value: val }))}>
                                            <defs>
                                                <linearGradient id={`grad-${iface.name}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={iface.status === 'up' ? "#22d3ee" : "#6b7280"} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={iface.status === 'up' ? "#22d3ee" : "#6b7280"} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="value" stroke={iface.status === 'up' ? "#22d3ee" : "#6b7280"} strokeWidth={1.5} fill={`url(#grad-${iface.name})`} dot={false} />
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by IP, port, or protocol..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-card/60 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground/80 placeholder-muted-foreground/60 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            />
                        </div>
                        <div className="relative w-48">
                            <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Filter Flags (e.g. syn)"
                                value={flagFilter}
                                onChange={e => setFlagFilter(e.target.value)}
                                className="w-full bg-card/60 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground/80 placeholder-muted-foreground/60 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            />
                        </div>
                        <button
                            onClick={() => exportToCSV(filteredLog, 'live_traffic')}
                            className="px-4 bg-card/60 border border-border rounded-lg hover:border-border/80 hover:bg-secondary flex items-center gap-2 text-xs text-foreground/80 transition-colors"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV
                        </button>
                    </div>

                    {/* Live Packet Table */}
                    <div className="bg-card/60 border border-border rounded-xl overflow-hidden">
                        <div ref={logRef} className="h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-card/95 border-b border-border z-10">
                                    <tr>
                                        <th className="text-left text-muted-foreground font-medium px-3 py-2 text-[10px]">TIME</th>
                                        <th className="text-left text-muted-foreground font-medium px-3 py-2 text-[10px]">PROTO</th>
                                        <th className="text-left text-muted-foreground font-medium px-3 py-2 text-[10px]">FLAGS</th>
                                        <th className="text-left text-muted-foreground font-medium px-3 py-2 text-[10px]">SOURCE</th>
                                        <th className="text-center text-muted-foreground font-medium px-1 py-2 text-[10px]"></th>
                                        <th className="text-left text-muted-foreground font-medium px-3 py-2 text-[10px]">DESTINATION</th>
                                        <th className="text-right text-muted-foreground font-medium px-3 py-2 text-[10px]">SIZE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLog.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center text-muted-foreground/60 py-12">No packets matching filters</td></tr>
                                    ) : (
                                        filteredLog.map((pkt, i) => (
                                            <tr key={i} className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${pkt.suspicious ? 'bg-red-500/5' : ''}`}>
                                                <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">{pkt.time}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                                                        color: PROTO_COLORS[pkt.proto] || '#9ca3af',
                                                        background: `${PROTO_COLORS[pkt.proto] || '#6b7280'}20`
                                                    }}>
                                                        {pkt.proto}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">
                                                    {pkt.flags && pkt.flags !== 'None' ? (
                                                        <span className="text-xs text-cyan-600">{pkt.flags}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground/30">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-foreground/80 text-[10px]">{pkt.src}</td>
                                                <td className="px-1 py-1.5 text-muted-foreground/60 text-center text-[10px]">→</td>
                                                <td className="px-3 py-1.5 font-mono text-foreground/80 text-[10px]">{pkt.dst}</td>
                                                <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px] text-right">{pkt.size} B</td>
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
                        <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                            <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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
                        <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                            <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-400" /> Traffic Statistics
                        </h2>
                        <button
                            onClick={() => exportToCSV(
                                Object.entries(analyticsData.protocols).map(([p, v]) => ({ Protocol: p, Packets: v, Bytes: analyticsData.bytes_per_protocol?.[p] || 0 })),
                                'statistics'
                            )}
                            className="px-3 py-1.5 bg-card/60 border border-border rounded-lg hover:border-border/80 hover:bg-secondary flex items-center gap-2 text-xs text-foreground/80 transition-colors"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export CSV
                        </button>
                    </div>

                    {/* Row 2: Protocol Distribution + Top Devices */}
                    {dashboardConfig.showProtocolCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Protocol Distribution */}
                            <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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
                                                <span className="text-muted-foreground w-12">{entry.name}</span>
                                                <span className="text-muted-foreground font-mono">{entry.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Top Devices */}
                            <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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
                            <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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
                            <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4">
                                <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
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

                    {/* Application Traffic Categories */}
                    {dashboardConfig.showTrafficCategories && (
                        <div className="grid grid-cols-1 gap-6">
                            <TrafficCategoriesWidget />
                        </div>
                    )}

                    {/* 7x24 Traffic Heatmap */}
                    <div className="bg-card/60 border border-border rounded-xl p-3 md:p-4 mt-6">
                        <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" /> 7×24 Traffic Heatmap (Volume)
                        </h3>
                        <div className="grid grid-cols-[auto_1fr] gap-2 lg:gap-4 overflow-x-auto custom-scrollbar pb-2">
                            {/* Days Column */}
                            <div className="flex flex-col gap-1 pr-2 border-r border-border justify-between py-1 mt-5">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="text-[10px] text-muted-foreground font-medium h-4 sm:h-6 flex items-center">{d}</div>
                                ))}
                            </div>

                            {/* Heatmap Grid */}
                            <div className="min-w-[600px]">
                                <div className="grid grid-cols-24 gap-1 mb-2" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                    {[...Array(24)].map((_, i) => (
                                        <div key={i} className="text-[9px] text-muted-foreground/60 text-center">{i}</div>
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
                                                // Minimum opacity 0.05, max 1.0
                                                const opacity = Math.max(0.05, normalized);
                                                return (
                                                    <div
                                                        key={`${day}-${h}`}
                                                        title={`${day} ${h}:00 - ${formatBytes(val)}`}
                                                        className="h-4 sm:h-6 rounded-[2px] cursor-pointer hover:ring-1 hover:ring-cyan-400 transition-all duration-200 group relative"
                                                        style={{ backgroundColor: `rgba(34, 211, 238, ${opacity})` }}
                                                    >
                                                        {val > 0 && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-secondary text-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 z-10 pointer-events-none whitespace-nowrap shadow-xl border border-border">
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
                    <div className="bg-card/60 border border-border rounded-xl p-4 w-full relative overflow-hidden">
                        <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Globe className="w-4 h-4 text-cyan-400" /> Global Threat Map
                            </h3>
                            <span className="text-xs text-muted-foreground mt-1">{externalConnections.length} Active Connections</span>
                        </div>

                        <div className="w-full h-[350px] bg-[#0A0B0E] rounded-lg border border-border/50 mt-8 mb-2 flex items-center justify-center relative shadow-inner">
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
                                                fill="#1e293b"
                                                stroke="#334155"
                                                strokeWidth={0.5}
                                                style={{
                                                    default: { outline: "none" },
                                                    hover: { fill: "#334155", outline: "none" },
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

                    <div className="bg-card/60 border border-border rounded-xl overflow-hidden mt-6">
                        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-blue-400" />
                                <h3 className="text-xs font-medium text-white">Connection Details</h3>
                            </div>
                            <button
                                onClick={() => exportToCSV(externalConnections, 'connections')}
                                className="px-3 py-1 bg-secondary/50 border border-border rounded-lg hover:border-border/80 hover:bg-secondary flex items-center gap-2 text-[10px] text-foreground/80 transition-colors ml-auto"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
                            </button>
                        </div>
                        <div className="h-[400px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-card/95 border-b border-border">
                                    <tr>
                                        <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">IP ADDRESS</th>
                                        <th className="text-left text-muted-foreground font-medium px-5 py-3 text-xs">LOCATION</th>
                                        <th className="text-right text-muted-foreground font-medium px-5 py-3 text-xs">HITS</th>
                                        <th className="text-right text-muted-foreground font-medium px-5 py-3 text-xs">TRAFFIC</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {externalConnections.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center text-muted-foreground/60 py-12">No external connections detected yet</td></tr>
                                    ) : (
                                        externalConnections.sort((a, b) => b.bytes - a.bytes).map((conn, i) => (
                                            <tr key={i} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                                                <td className="px-5 py-3 font-mono text-foreground/80 text-xs">{conn.ip}</td>
                                                <td className="px-5 py-3 text-muted-foreground text-xs">
                                                    <span className="mr-1">🌍</span> {conn.city}, {conn.country}
                                                </td>
                                                <td className="px-5 py-3 font-mono text-muted-foreground text-xs text-right">{conn.hits.toLocaleString()}</td>
                                                <td className="px-5 py-3 font-mono text-cyan-400 text-xs text-right">{formatBytes(conn.bytes)}</td>
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
                <div className="bg-card/60 border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-white">Security Events</h3>
                        <span className="ml-auto text-[10px] text-muted-foreground">{securityEvents.length} events</span>
                        <button
                            onClick={() => exportToCSV(securityEvents, 'security_events')}
                            className="ml-2 px-3 py-1 bg-secondary/50 border border-border rounded hover:border-border/80 hover:bg-secondary flex items-center gap-2 text-xs text-foreground/80 transition-colors"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
                        </button>
                        <button onClick={() => setShowRulesModal(true)} className="ml-2 px-2 py-1 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded text-xs font-medium transition-colors flex items-center gap-1">
                            <Settings className="w-3 h-3" /> Configure Rules
                        </button>
                    </div>
                    <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {securityEvents.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 flex flex-col items-center gap-2">
                                <Shield className="w-8 h-8 text-green-500/50" />
                                <span>No security events detected. Safe seas! 🌊</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {securityEvents.map((event) => (
                                    <div key={event.id} className="flex items-start justify-between p-3 rounded-lg bg-secondary/40 border border-border/50 hover:border-border/80 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${event.severity === 'CRITICAL' ? 'text-red-500' :
                                                event.severity === 'HIGH' ? 'text-orange-500' : 'text-yellow-500'
                                                }`} />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-foreground/90 text-sm">{event.event_type}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground font-mono">
                                                        {event.source_ip || 'Unknown IP'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                                                <p className="text-[10px] text-muted-foreground/60 mt-1.5">{new Date(event.timestamp).toLocaleString()}</p>
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
            {showRulesModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-10">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-400" />
                                Security Alert Rules
                            </h2>
                            <button onClick={() => { setShowRulesModal(false); setEditingRule(null); }} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {!editingRule ? (
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-sm text-muted-foreground">Manage real-time alert rules for network traffic anomalies.</p>
                                        <button onClick={() => setEditingRule({ name: '', description: '', condition: '', action: 'alert', is_active: true })} className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded shadow-lg transition-colors flex items-center gap-1">
                                            <Plus className="w-3.5 h-3.5" /> New Rule
                                        </button>
                                    </div>

                                    {rulesLoading ? (
                                        <div className="py-8 text-center text-sm text-muted-foreground">Loading rules...</div>
                                    ) : rules.length === 0 ? (
                                        <div className="py-8 text-center border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                                            No alert rules configured yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {rules.map((rule) => (
                                                <div key={rule.id} className={`p-4 rounded-lg border ${rule.is_active ? 'bg-secondary/40 border-border/50' : 'bg-card/40 border-border/80'} flex items-center justify-between group`}>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-green-400' : 'bg-muted-foreground/60'}`}></div>
                                                            <h4 className={`font-medium text-sm ${rule.is_active ? 'text-foreground/90' : 'text-muted-foreground'}`}>{rule.name}</h4>
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary border border-border text-muted-foreground uppercase">{rule.action}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{rule.description || 'No description'}</p>
                                                        <div className="mt-2 text-xs font-mono text-indigo-300 bg-indigo-900/20 px-2 py-1 rounded inline-block">
                                                            {rule.condition}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditingRule(rule)} className="p-1.5 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => rule.id && handleDeleteRule(rule.id)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <form className="space-y-4" onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSaveRule(editingRule);
                                }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground/80">Rule Name <span className="text-red-400">*</span></label>
                                            <input required type="text" value={editingRule.name} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:border-indigo-500" placeholder="e.g. High HTTP Traffic" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground/80">Action</label>
                                            <select value={editingRule.action} onChange={e => setEditingRule({ ...editingRule, action: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:border-indigo-500">
                                                <option value="alert">Alert Only</option>
                                                <option value="block">Block</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground/80">Description</label>
                                        <input type="text" value={editingRule.description} onChange={e => setEditingRule({ ...editingRule, description: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:border-indigo-500" placeholder="Optional description..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-foreground/80">Condition Expression <span className="text-red-400">*</span></label>
                                        <input required type="text" value={editingRule.condition} onChange={e => setEditingRule({ ...editingRule, condition: e.target.value })} className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500" placeholder="e.g. bytes > 500000 && proto == 'HTTP'" />
                                        <p className="text-[10px] text-muted-foreground mt-1">Available variables: bytes, packets, proto, src_ip, dst_ip</p>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input type="checkbox" id="isActive" checked={editingRule.is_active} onChange={e => setEditingRule({ ...editingRule, is_active: e.target.checked })} className="w-3.5 h-3.5 bg-background border-border rounded rounded text-indigo-500 focus:ring-0" />
                                        <label htmlFor="isActive" className="text-sm text-foreground/80 cursor-pointer">Rule is active</label>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                                        <button type="button" onClick={() => setEditingRule(null)} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                        <button type="submit" className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded shadow-lg transition-colors flex items-center gap-1">
                                            <Save className="w-4 h-4" /> Save Rule
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
