import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useDevices } from '../hooks/useDevices';
import { useContainers } from '../hooks/useDocker';
import { useHealth } from '../hooks/useSystem';
import { useAnalyticsSummary } from '../hooks/useAnalytics';
import SystemDetailOverlay from './SystemDetailOverlay';
import { Device } from '../types';

interface DashboardProps {
    timeRange?: string;
}

interface DockerContainerSummary {
    id: string;
    name: string;
    cpu_pct?: number;
    mem_usage?: string;
    net?: string;
    status?: string;
    isHot?: boolean;
}

interface BandwidthChartPoint {
    time: string;
    download: number;
    upload: number;
}

const generateBaselineTimeline = (range: string): BandwidthChartPoint[] => {
    const pointsCount = range === '15m' ? 8 : range === '6h' ? 7 : range === '24h' ? 8 : 7;
    const now = new Date();
    const points: BandwidthChartPoint[] = [];
    const intervalMinutes = range === '15m' ? 2 : range === '6h' ? 60 : range === '24h' ? 180 : 30;

    for (let i = pointsCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        points.push({ time: timeStr, download: 0, upload: 0 });
    }
    return points;
};

const Dashboard: React.FC<DashboardProps> = ({ timeRange = '1h' }) => {
    const { wsData, notifications } = useWebSocket();
    const { data: devicesData = [] } = useDevices();
    const { data: containersData = [] } = useContainers();
    const { data: health } = useHealth();
    const { data: analytics } = useAnalyticsSummary();

    const [overlayOpen, setOverlayOpen] = useState(false);
    const [overlayType, setOverlayType] = useState<'cpu' | 'ram' | 'disk' | 'all'>('all');

    // Devices & Containers safety
    const safeDevices: Device[] = useMemo(() => {
        if (Array.isArray(devicesData)) return devicesData;
        if (devicesData && typeof devicesData === 'object' && 'items' in devicesData && Array.isArray((devicesData as { items: Device[] }).items)) {
            return (devicesData as { items: Device[] }).items;
        }
        return [];
    }, [devicesData]);

    const safeContainers: DockerContainerSummary[] = useMemo(() => {
        return Array.isArray(containersData) ? (containersData as DockerContainerSummary[]) : [];
    }, [containersData]);

    // Calculate live throughput
    const latestTraffic = wsData.length > 0 ? wsData[wsData.length - 1] : null;
    const downloadMbps = latestTraffic && typeof latestTraffic.download === 'number'
        ? (latestTraffic.download * 8 / 1024).toFixed(1)
        : '0.0';
    const uploadMbps = latestTraffic && typeof latestTraffic.upload === 'number'
        ? (latestTraffic.upload * 8 / 1024).toFixed(1)
        : '0.0';
    const totalThroughput = (parseFloat(downloadMbps) + parseFloat(uploadMbps)).toFixed(1);

    const onlineDevicesCount = safeDevices.filter((d) => d.is_online).length;
    const activeContainersCount = safeContainers.filter((c) => c.status?.toLowerCase().includes('up')).length;

    // Chart telemetry data
    const chartData: BandwidthChartPoint[] = useMemo(() => {
        if (wsData && wsData.length > 0) {
            return wsData.map((d, idx) => ({
                time: typeof d.time === 'string' ? d.time : `T-${idx}`,
                download: Math.round(Number(d.download || 0) * 8 / 1024),
                upload: Math.round(Number(d.upload || 0) * 8 / 1024),
            }));
        }
        return generateBaselineTimeline(timeRange);
    }, [wsData, timeRange]);

    // Live events
    const displayEvents = useMemo(() => {
        if (notifications && notifications.length > 0) {
            return notifications.slice(0, 6).map((n) => {
                const date = new Date(n.timestamp);
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                const dotColor = n.type === 'error' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warn)' : 'var(--ok)';
                return {
                    id: n.id,
                    time: timeStr,
                    color: dotColor,
                    text: n.title || n.description,
                };
            });
        }
        return [];
    }, [notifications]);

    return (
        <div className="space-y-[var(--gap)]">
            {/* 1. Stat KPI Strip */}
            <section className="panel strip" aria-label="Key numbers">
                <div className="cell">
                    <span className="label">Throughput</span>
                    <span className="value num">
                        {totalThroughput} <small className="muted text-[13px] font-normal">Mbps</small>
                    </span>
                    <span className={`note ${parseFloat(totalThroughput) > 0 ? 'ok' : ''}`}>
                        {parseFloat(totalThroughput) > 0 ? 'Active Stream' : 'Idle'}
                    </span>
                </div>
                <div className="cell">
                    <span className="label">Devices online</span>
                    <span className="value num">{onlineDevicesCount}</span>
                    <span className="note">{safeDevices.length} registered</span>
                </div>
                <div className="cell">
                    <span className="label">Packets per second</span>
                    <span className="value num">
                        {analytics?.packets_per_sec != null
                            ? analytics.packets_per_sec.toLocaleString()
                            : (parseFloat(totalThroughput) > 0 ? 'Active' : '0')}
                    </span>
                    <span className="note ok">Real-time</span>
                </div>
                <div className="cell">
                    <span className="label">Latency</span>
                    <span className="value num">
                        {analytics?.latency_ms != null
                            ? `${Math.round(analytics.latency_ms)}`
                            : (health?.status ? 'Nominal' : '—')}
                        {analytics?.latency_ms != null && (
                            <small className="muted text-[13px] font-normal"> ms</small>
                        )}
                    </span>
                    <span className="note">{health?.status || 'Active'}</span>
                </div>
                <div className="cell cursor-pointer" onClick={() => { setOverlayType('all'); setOverlayOpen(true); }}>
                    <span className="label">System health</span>
                    <span className={`value num ${health?.score != null && health.score < 80 ? 'warn' : ''}`}>
                        {health?.score != null ? `${health.score}%` : (health?.status ? 'Healthy' : '—')}
                    </span>
                    <span className="note ok">{health?.status || 'Operational'}</span>
                </div>
            </section>

            {/* 2. Main Grid: Bandwidth Chart + Live Events */}
            <div className="grid-main">
                {/* Bandwidth Chart Panel */}
                <section className="panel" aria-labelledby="bw">
                    <div className="panel-head">
                        <div className="flex items-center gap-2">
                            <h2 id="bw">Bandwidth</h2>
                            <span className="text-[10px] font-mono text-faint uppercase px-1.5 py-0.5 rounded-[4px] bg-raised border border-line">
                                {timeRange}
                            </span>
                        </div>
                        <div className="legend">
                            <span><i className="dl"></i>Download</span>
                            <span><i className="ul"></i>Upload</span>
                            <span><i className="lim"></i>Limit 300 Mbps</span>
                        </div>
                    </div>
                    <div className="chart">
                        <ResponsiveContainer width="100%" height={230}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="consoleDlFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7c8cff" stopOpacity={0.12} />
                                        <stop offset="100%" stopColor="#7c8cff" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#1e232c" vertical={false} />
                                <XAxis dataKey="time" stroke="#5d6574" fontSize={11} tickLine={false} axisLine={false} dy={6} />
                                <YAxis stroke="#5d6574" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                                <ReferenceLine y={300} stroke="#f5a524" strokeDasharray="4 4" strokeWidth={1} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--panel)',
                                        border: '1px solid var(--line-strong)',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        color: 'var(--text)',
                                    }}
                                    itemStyle={{ color: 'var(--text)' }}
                                    labelStyle={{ color: 'var(--muted)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="download"
                                    stroke="#7c8cff"
                                    strokeWidth={2}
                                    fill="url(#consoleDlFill)"
                                    isAnimationActive={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="upload"
                                    stroke="#4fd1e8"
                                    strokeWidth={1.5}
                                    fill="none"
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="axis">
                            <span>{chartData[0]?.time || '—'}</span>
                            <span>{chartData[Math.floor(chartData.length / 2)]?.time || '—'}</span>
                            <span>{chartData[chartData.length - 1]?.time || '—'}</span>
                        </div>
                    </div>
                </section>

                {/* Live Events Panel */}
                <section className="panel" aria-labelledby="ev">
                    <div className="panel-head">
                        <h2 id="ev">Live events</h2>
                        <span className="status live">Streaming</span>
                    </div>
                    <ul className="events">
                        {displayEvents.length > 0 ? (
                            displayEvents.map((ev) => (
                                <li key={ev.id} className="event">
                                    <span className="mono">{ev.time}</span>
                                    <span className="dot" style={{ backgroundColor: ev.color }} />
                                    <span className="text-text-soft truncate">{ev.text}</span>
                                </li>
                            ))
                        ) : (
                            <li className="py-8 text-center text-xs text-muted">
                                No security or anomalous events recorded
                            </li>
                        )}
                    </ul>
                </section>
            </div>

            {/* 3. Devices Ops Table */}
            <section className="panel" aria-labelledby="dv">
                <div className="panel-head">
                    <h2 id="dv">Devices</h2>
                    <span className="meta">{safeDevices.length} total</span>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Device</th>
                                <th>Address</th>
                                <th>MAC vendor</th>
                                <th>Type</th>
                                <th className="right">Traffic</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {safeDevices.length > 0 ? (
                                safeDevices.slice(0, 5).map((d) => (
                                    <tr key={d.id || d.mac_address}>
                                        <td className="font-medium text-text">{d.hostname || d.nickname || `Device-${d.id}`}</td>
                                        <td className="mono">{d.ip_address || '—'}</td>
                                        <td className="muted">{d.vendor || 'Generic'}</td>
                                        <td className="muted">{d.type || 'Standard'}</td>
                                        <td className="right num">{d.download || '0 B/s'}</td>
                                        <td>
                                            <span className={`status ${d.is_online ? '' : 'idle'}`}>
                                                {d.is_online ? 'Active' : 'Idle'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-muted text-xs">
                                        No network devices discovered yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 4. Containers Ops Table */}
            <section className="panel" aria-labelledby="ct">
                <div className="panel-head">
                    <h2 id="ct">Containers</h2>
                    <span className="meta">{activeContainersCount} running</span>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>CPU</th>
                                <th className="right">Memory</th>
                                <th className="right">Network</th>
                                <th>State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {safeContainers.length > 0 ? (
                                safeContainers.slice(0, 4).map((c) => {
                                    const cpuVal = Math.round(c.cpu_pct || 0);
                                    const isHot = cpuVal > 80 || !!c.isHot;
                                    return (
                                        <tr key={c.id || c.name}>
                                            <td className="font-medium text-text">{c.name}</td>
                                            <td>
                                                <div className={`meter ${isHot ? 'hot' : ''}`}>
                                                    <div className="track">
                                                        <i style={{ width: `${Math.min(100, cpuVal)}%` }}></i>
                                                    </div>
                                                    <span className="num">{cpuVal}%</span>
                                                </div>
                                            </td>
                                            <td className="right num">{c.mem_usage || '—'}</td>
                                            <td className="right num">{c.net || '—'}</td>
                                            <td>
                                                <span className={`status ${isHot ? 'warn' : ''}`}>
                                                    {c.status || (isHot ? 'High CPU' : 'Running')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-6 text-muted text-xs">
                                        No containers running on local daemon
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* System Overlay Drawer */}
            <SystemDetailOverlay
                isOpen={overlayOpen}
                onClose={() => setOverlayOpen(false)}
                initialType={overlayType}
            />
        </div>
    );
};

export default Dashboard;
