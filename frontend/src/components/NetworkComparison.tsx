
import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts';
import {
    ArrowRightLeft, Calendar, TrendingUp, TrendingDown, Activity,
    Timer
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';

interface HistoryPoint {
    timestamp: string;
    interface: string;
    bytes_sent: number;
    bytes_recv: number;
}

interface ComparisonData {
    periodA: HistoryPoint[];
    periodB: HistoryPoint[];
}

interface MetricSummary {
    totalUpload: number;
    totalDownload: number;
    avgUploadRate: number;
    avgDownloadRate: number;
}

const NetworkComparison: React.FC = () => {
    const [rangeA, setRangeA] = useState('24h'); // 1h, 24h, 7d
    const [rangeB, setRangeB] = useState('prev_24h'); // prev_1h, prev_24h, prev_7d
    const [data, setData] = useState<ComparisonData>({ periodA: [], periodB: [] });
    const [loading, setLoading] = useState(false);

    // Helpers
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getRangeDates = (range: string) => {
        const end = new Date();
        const start = new Date();

        // Adjust for "Previous" ranges (offset)
        if (range.startsWith('prev_')) {
            const baseRange = range.replace('prev_', '');
            if (baseRange === '1h') {
                end.setHours(end.getHours() - 1);
                start.setHours(start.getHours() - 2);
            } else if (baseRange === '24h') {
                end.setDate(end.getDate() - 1);
                start.setDate(start.getDate() - 2);
            } else if (baseRange === '7d') {
                end.setDate(end.getDate() - 7);
                start.setDate(start.getDate() - 14);
            }
        } else {
            // Current ranges
            if (range === '1h') start.setHours(start.getHours() - 1);
            if (range === '24h') start.setDate(start.getDate() - 1);
            if (range === '7d') start.setDate(start.getDate() - 7);
        }

        return { start, end };
    };

    useEffect(() => {
        fetchData();
    }, [rangeA, rangeB]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const datesA = getRangeDates(rangeA);
            const datesB = getRangeDates(rangeB);

            // Fetch concurrently
            const [resA, resB] = await Promise.all([
                axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY_SYSTEM, {
                    params: { start: datesA.start.toISOString(), end: datesA.end.toISOString() }
                }),
                axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY_SYSTEM, {
                    params: { start: datesB.start.toISOString(), end: datesB.end.toISOString() }
                })
            ]);

            setData({ periodA: resA.data, periodB: resB.data });
        } catch (error) {
            console.error("Failed to fetch comparison data", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateMetrics = (points: HistoryPoint[]): MetricSummary => {
        if (!points.length) return { totalUpload: 0, totalDownload: 0, avgUploadRate: 0, avgDownloadRate: 0 };

        // Sum logic (simplified, assuming points are cumulative counters or snapshots? 
        // Actually system_network_history in backend seems to be raw snapshots from vnstat logic?
        // Let's assume they are absolute counters or regular snapshots. 
        // If they are counters, we need delta. If they are 'bytes per second' or similar?
        // Based on endpoints.py: models.SystemNetworkHistory has bytes_sent/recv.
        // Usually these need delta calculation if they are counters.
        // But let's assume for now we sum up 'bytes_sent' if they represent usage in that interval, 
        // or take max-min if they are counters.
        // Looking at backend `docker_monitor` it does max-min.
        // `SystemNetworkHistory` in `system_monitor.py` (not shown) likely records periodical snapshots.
        // For visual comparison, let's assume we can just sum them up if they are interval-based, 
        // or if they are counters, we need to handle that. 
        // Let's treat them as interval usage for now to be safe with the graph.

        let totalUp = 0;
        let totalDown = 0;

        // Check if data looks like counters (strictly increasing)
        const isCounter = points.length > 1 && points[1].bytes_sent >= points[0].bytes_sent;

        if (isCounter) {
            totalUp = points[points.length - 1].bytes_sent - points[0].bytes_sent;
            totalDown = points[points.length - 1].bytes_recv - points[0].bytes_recv;
        } else {
            // Already interval data
            totalUp = points.reduce((acc, curr) => acc + curr.bytes_sent, 0);
            totalDown = points.reduce((acc, curr) => acc + curr.bytes_recv, 0);
        }

        return {
            totalUpload: totalUp,
            totalDownload: totalDown,
            avgUploadRate: totalUp / points.length, // Rough approx
            avgDownloadRate: totalDown / points.length
        };
    };

    const statsA = calculateMetrics(data.periodA);
    const statsB = calculateMetrics(data.periodB);

    // Normalize data for chart (align by percentage/index)
    const chartData = data.periodA.map((pointA, i) => {
        const pointB = data.periodB[i] || {};
        return {
            time: `Point ${i}`, // Simplified time axis for overlay
            uploadA: pointA.bytes_sent,
            downloadA: pointA.bytes_recv,
            uploadB: pointB.bytes_sent || 0,
            downloadB: pointB.bytes_recv || 0,
            originalTimeA: pointA.timestamp,
            originalTimeB: pointB.timestamp
        };
    });

    const getDiff = (curr: number, prev: number) => {
        if (prev === 0) return 100;
        return ((curr - prev) / prev) * 100;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/40 p-4 rounded-xl border border-gray-800 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Network Comparison</h2>
                        <p className="text-xs text-gray-400">Analyze performance across different timeframes</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Period A</label>
                        <select
                            value={rangeA}
                            onChange={(e) => setRangeA(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="1h">Last Hour</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                    </div>

                    <span className="text-gray-600 mt-4">VS</span>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold ml-1">Period B</label>
                        <select
                            value={rangeB}
                            onChange={(e) => setRangeB(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="prev_1h">Previous Hour</option>
                            <option value="prev_24h">Previous 24 Hours</option>
                            <option value="prev_7d">Previous 7 Days</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Period A Stats */}
                <div className="bg-gray-900/60 border border-indigo-500/30 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Calendar className="w-24 h-24 text-indigo-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-indigo-300">Period A (Current)</h3>
                        <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">
                            {rangeA === '24h' ? 'Last 24h' : rangeA}
                        </span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Total Download</p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold text-white">{formatBytes(statsA.totalDownload)}</span>
                                <span className={`text-xs flex items-center ${getDiff(statsA.totalDownload, statsB.totalDownload) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {getDiff(statsA.totalDownload, statsB.totalDownload) > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                    {Math.abs(getDiff(statsA.totalDownload, statsB.totalDownload)).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Total Upload</p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold text-white">{formatBytes(statsA.totalUpload)}</span>
                                <span className={`text-xs flex items-center ${getDiff(statsA.totalUpload, statsB.totalUpload) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {getDiff(statsA.totalUpload, statsB.totalUpload) > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                    {Math.abs(getDiff(statsA.totalUpload, statsB.totalUpload)).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period B Stats */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Timer className="w-24 h-24 text-gray-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-gray-400">Period B (Baseline)</h3>
                        <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                            {rangeB === 'prev_24h' ? 'Prev 24h' : rangeB}
                        </span>
                    </div>
                    <div className="space-y-4 opacity-75">
                        <div>
                            <p className="text-gray-500 text-xs mb-1">Total Download</p>
                            <span className="text-2xl font-bold text-gray-300">{formatBytes(statsB.totalDownload)}</span>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs mb-1">Total Upload</p>
                            <span className="text-2xl font-bold text-gray-300">{formatBytes(statsB.totalUpload)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 md:p-6">
                <h3 className="text-sm font-medium text-gray-300 mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Traffic Trend Comparison
                </h3>
                <div className="h-[350px] w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            Loading comparison data...
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorDownA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorDownB" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="time" hide />
                                <YAxis stroke="#4b5563" fontSize={12} tickFormatter={formatBytes} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e5e7eb' }}
                                    formatter={(value: number) => formatBytes(value)}
                                    labelFormatter={() => `Data Point`}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="downloadA"
                                    name="Current Download"
                                    stroke="#22d3ee"
                                    fill="url(#colorDownA)"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="downloadB"
                                    name="Baseline Download"
                                    stroke="#94a3b8"
                                    fill="url(#colorDownB)"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NetworkComparison;
