import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Laptop, Activity } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface TopStatsData {
    network: {
        sent: number;
        recv: number;
    };
    active_devices: number;
}

const TopStatsRow = () => {
    const [stats, setStats] = useState<TopStatsData | null>(null);
    const [health, setHealth] = useState({ score: 0, status: 'Unknown' });

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SYSTEM.INFO}`);
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`);
            const data = await res.json();
            setHealth(data);
        } catch (error) {
            console.error('Failed to fetch health:', error);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchHealth();
        const interval = setInterval(() => {
            fetchStats();
            fetchHealth();
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
            border: 'border-blue-500/20'
        },
        {
            title: 'Total Upload',
            value: stats ? formatBytes(stats.network.sent) : '...',
            icon: ArrowUp,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20'
        },
        {
            title: 'Active Devices',
            value: stats ? stats.active_devices.toString() : '...',
            icon: Laptop,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        },
        {
            title: 'Network Health',
            value: `${health.score}%`,
            subValue: health.status,
            icon: Activity,
            color: health.status === 'Excellent' ? 'text-emerald-400' : 'text-amber-400',
            bg: health.status === 'Excellent' ? 'bg-emerald-500/10' : 'bg-amber-500/10',
            border: health.status === 'Excellent' ? 'border-emerald-500/20' : 'border-amber-500/20'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-[#0A0B0E] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
                >
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
                </motion.div>
            ))}
        </div>
    );
};

export default TopStatsRow;
