import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Server,
    Cpu,
    Database,
    HardDrive,
    Activity,
    Clock,
    Network,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface SystemInfo {
    hostname: string;
    uptime: string;
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

    const fetchInfo = async () => {
        try {
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SYSTEM.INFO}`);
            const data = await res.json();
            setInfo(data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch system info:', error);
        }
    };

    useEffect(() => {
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

    if (loading || !info) {
        return (
            <div className="bg-[#0A0B0E] border border-white/5 rounded-2xl p-6 h-[400px] animate-pulse flex items-center justify-center">
                <div className="text-white/20">Loading system metrics...</div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0A0B0E] border border-white/5 rounded-2xl overflow-hidden group"
        >
            <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Server className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-lg">{info.hostname}</h3>
                            <div className="flex items-center gap-2 text-white/40 text-xs">
                                <Clock className="w-3 h-3" />
                                <span>Uptime: {info.uptime}</span>
                                <span className="mx-1">•</span>
                                <Network className="w-3 h-3 text-indigo-400" />
                                <span>{info.active_devices} Devices</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                        Online
                    </div>
                </div>

                <div className="space-y-6">
                    {/* CPU Utilization */}
                    <div
                        className="space-y-2 cursor-pointer group/item"
                        onClick={() => onDetailClick('cpu')}
                    >
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-white/60">
                                <Cpu className="w-3.5 h-3.5" />
                                <span>CPU Utilization</span>
                            </div>
                            <span className="text-white font-medium">{info.cpu_pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${info.cpu_pct}%` }}
                                className={`h-full rounded-full ${info.cpu_pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-white/30 pt-1">
                            <span>Usage Load: {info.cpu_load.toFixed(2)}</span>
                            <span className="group-hover/item:text-blue-400 transition-colors">View details →</span>
                        </div>
                    </div>

                    {/* RAM Usage */}
                    <div
                        className="space-y-2 cursor-pointer group/item"
                        onClick={() => onDetailClick('ram')}
                    >
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-white/60">
                                <Database className="w-3.5 h-3.5" />
                                <span>Memory (RAM)</span>
                            </div>
                            <span className="text-white font-medium">{info.ram.percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${info.ram.percent}%` }}
                                className={`h-full rounded-full ${info.ram.percent > 90 ? 'bg-red-500' : 'bg-purple-500'}`}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-white/30 pt-1">
                            <span>{formatBytes(info.ram.used)} / {formatBytes(info.ram.total)}</span>
                            <span className="group-hover/item:text-purple-400 transition-colors">View details →</span>
                        </div>
                    </div>

                    {/* Disk Usage */}
                    <div
                        className="space-y-2 cursor-pointer group/item"
                        onClick={() => onDetailClick('disk')}
                    >
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-white/60">
                                <HardDrive className="w-3.5 h-3.5" />
                                <span>Disk Storage</span>
                            </div>
                            <span className="text-white font-medium">{info.disk.percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${info.disk.percent}%` }}
                                className="h-full bg-orange-500 rounded-full"
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-white/30 pt-1">
                            <span>{formatBytes(info.disk.used)} / {formatBytes(info.disk.total)}</span>
                            <span className="group-hover/item:text-orange-400 transition-colors">View details →</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                            <span>Total Sent</span>
                        </div>
                        <div className="text-white font-semibold text-sm">
                            {formatBytes(info.network.sent)}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">
                            <ArrowDownLeft className="w-3 h-3 text-blue-400" />
                            <span>Total Received</span>
                        </div>
                        <div className="text-white font-semibold text-sm">
                            {formatBytes(info.network.recv)}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ServerStatusCard;
