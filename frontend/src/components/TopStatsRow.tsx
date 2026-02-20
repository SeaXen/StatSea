import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Laptop, Activity } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';
import { StatCardSkeleton } from './skeletons/StatCardSkeleton';

interface TopStatsData {
    network: {
        sent: number;
        recv: number;
    };
    active_devices: number;
}

interface HistoryData {
    timestamp: string;
    upload: number;
    download: number;
}

const TopStatsRow = () => {
    const [stats, setStats] = useState<TopStatsData | null>(null);
    const [health, setHealth] = useState({ score: 0, status: 'Unknown' });
    const [history, setHistory] = useState<HistoryData[]>([]);

    const fetchStats = async () => {
        try {
            const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.SYSTEM.INFO);
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH);
            setHealth({
                score: res.data.score ?? (res.data.status === 'healthy' ? 100 : 0),
                status: res.data.status || 'Excellent'
            });
        } catch (error) {
            console.error('Failed to fetch health:', error);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY}?limit=30`);
            setHistory(res.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchHealth();
        fetchHistory();
        const interval = setInterval(() => {
            fetchStats();
            fetchHealth();
            fetchHistory();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const cards = [
        {
            title: 'Total Download',
            value: stats ? formatBytes(stats.network.recv) : '...',
            icon: ArrowDown,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            chartData: history.map(h => ({ value: h.download })),
            chartColor: '#60a5fa'
        },
        {
            title: 'Total Upload',
            value: stats ? formatBytes(stats.network.sent) : '...',
            icon: ArrowUp,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            chartData: history.map(h => ({ value: h.upload })),
            chartColor: '#34d399'
        },
        {
            title: 'Active Devices',
            value: stats ? stats.active_devices.toString() : '...',
            icon: Laptop,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20',
            chartData: null, // No history for devices yet
            chartColor: '#c084fc'
        },
        {
            title: 'Network Health',
            value: `${health.score}%`,
            subValue: health.status,
            icon: Activity,
            color: health.status === 'Excellent' ? 'text-emerald-400' : 'text-amber-400',
            bg: health.status === 'Excellent' ? 'bg-emerald-500/10' : 'bg-amber-500/10',
            border: health.status === 'Excellent' ? 'border-emerald-500/20' : 'border-amber-500/20',
            chartData: null,
            chartColor: '#fbbf24'
        }
    ];

    if (!stats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-[#0A0B0E] border border-white/5 rounded-2xl p-4 relative overflow-hidden group"
                >
                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div>
                            <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">
                                {card.title}
                            </p>
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-white font-bold text-xl">{card.value}</h4>
                                {card.subValue && (
                                    <span className={`text-[10px] font-medium ${card.color}`}>
                                        {card.subValue}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center border ${card.border}`}>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                    </div>

                    {/* Sparkline Chart */}
                    {card.chartData && card.chartData.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-20 group-hover:opacity-30 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={card.chartData}>
                                    <defs>
                                        <linearGradient id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={card.chartColor} stopOpacity={0.5} />
                                            <stop offset="100%" stopColor={card.chartColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={card.chartColor}
                                        fill={`url(#gradient-${idx})`}
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    );
};

export default TopStatsRow;
