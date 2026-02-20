import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Server,
    Cpu,
    HardDrive,
    Activity,
    Clock,
    Network,
    Thermometer
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';
import { WidgetSkeleton } from './skeletons/WidgetSkeleton';

interface SystemInfo {
    hostname: string;
    uptime: string;
    temperature?: number | null;
    cpu_pct: number;
    cpu_load: number;
    ram: { total: number; used: number; percent: number };
    disk: { total: number; used: number; percent: number };
    network: { sent: number; recv: number };
    active_devices: number;
}

interface ServerStatusCardProps {
    onDetailClick: (type: 'cpu' | 'ram' | 'disk' | 'all') => void;
}

const ServerStatusCard: React.FC<ServerStatusCardProps> = ({ onDetailClick }) => {
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.SYSTEM.INFO);
                setInfo(res.data);
                setLoading(false);
                setLastUpdated(new Date());
            } catch (error) {
                console.error('Failed to fetch system info:', error);
            }
        };

        fetchInfo();
        const interval = setInterval(fetchInfo, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const renderDonut = (value: number, color: string) => {
        const data = [
            { name: 'Used', value: value },
            { name: 'Free', value: 100 - value },
        ];

        return (
            <div className="relative h-24 w-24 mx-auto my-2">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={45}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell key="cell-0" fill={color} />
                            <Cell key="cell-1" fill="rgba(255,255,255,0.05)" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-foreground">{Math.round(value)}%</span>
                </div>
            </div>
        );
    };

    if (loading || !info) {
        return <WidgetSkeleton />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden group h-full flex flex-col"
        >
            <div className="p-6 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                            <Server className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-semibold text-lg tracking-tight">{info.hostname}</h3>
                            <div className="flex items-center gap-3 text-muted-foreground text-xs mt-1">
                                <span className="flex items-center gap-1.5 bg-accent/50 px-2 py-0.5 rounded text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {info.uptime}
                                </span>
                                {info.temperature && (
                                    <span className="flex items-center gap-1.5 bg-destructive/10 px-2 py-0.5 rounded text-destructive border border-destructive/20">
                                        <Thermometer className="w-3 h-3" />
                                        {info.temperature}°C
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20 shadow-sm shadow-emerald-500/10 dark:text-emerald-400">
                            Online
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                            UPDATED {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 flex-1">
                    {/* CPU */}
                    <div
                        className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border hover:border-primary/30 transition-all cursor-pointer group/item relative overflow-hidden"
                        onClick={() => onDetailClick('cpu')}
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1 z-10">
                            <Cpu className="w-3.5 h-3.5" /> CPU
                        </div>
                        <div className="z-10">{renderDonut(info.cpu_pct, '#60a5fa')}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono z-10">
                            Load: {info.cpu_load.toFixed(2)}
                        </div>
                    </div>

                    {/* RAM */}
                    <div
                        className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border hover:border-purple-500/30 transition-all cursor-pointer group/item relative overflow-hidden"
                        onClick={() => onDetailClick('ram')}
                    >
                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-xs font-semibold text-purple-500 dark:text-purple-400 mb-1 z-10">
                            <Activity className="w-3.5 h-3.5" /> RAM
                        </div>
                        <div className="z-10">{renderDonut(info.ram.percent, '#c084fc')}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono z-10">
                            {formatBytes(info.ram.used)} / {formatBytes(info.ram.total)}
                        </div>
                    </div>

                    {/* Disk */}
                    <div
                        className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border hover:border-emerald-500/30 transition-all cursor-pointer group/item relative overflow-hidden"
                        onClick={() => onDetailClick('disk')}
                    >
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500 dark:text-emerald-400 mb-1 z-10">
                            <HardDrive className="w-3.5 h-3.5" /> DISK
                        </div>
                        <div className="z-10">{renderDonut(info.disk.percent, '#34d399')}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono z-10">
                            {formatBytes(info.disk.used)}
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Network className="w-3.5 h-3.5" />
                        <span>{info.network.recv ? formatBytes(info.network.recv) : '0 B'} ↓</span>
                        <span className="w-px h-3 bg-border" />
                        <span>{info.network.sent ? formatBytes(info.network.sent) : '0 B'} ↑</span>
                    </div>
                    <div>
                        {info.active_devices} Active Devices
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ServerStatusCard;
