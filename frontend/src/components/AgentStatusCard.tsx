import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Server,
    Cpu,
    HardDrive,
    Activity,
    Network,
    Clock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AgentResponse } from '../types';

interface AgentStatusCardProps {
    agent: AgentResponse;
}

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({ agent }) => {
    const isOnline = agent.status === 'online';

    // Parse the latest metrics from system_info if available
    const metrics = useMemo(() => {
        if (agent.system_info && agent.system_info.latest_metrics) {
            return agent.system_info.latest_metrics;
        }
        return {
            cpu_pct: 0,
            mem_usage: 0,
            disk_usage: 0,
            net_rx: 0,
            net_tx: 0
        };
    }, [agent.system_info]);

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const renderDonut = (value: number, color: string) => {
        const data = [
            { name: 'Used', value: Math.max(0, Math.min(100, value)) },
            { name: 'Free', value: Math.max(0, 100 - value) },
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
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <Server className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-semibold text-lg tracking-tight">{agent.name}</h3>
                            <div className="flex items-center gap-3 text-muted-foreground text-xs mt-1">
                                {agent.ip_address && (
                                    <span className="flex items-center gap-1.5 bg-accent/50 px-2 py-0.5 rounded text-muted-foreground">
                                        {agent.ip_address}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5 bg-accent/50 px-2 py-0.5 rounded text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {agent.last_seen ? new Date(agent.last_seen).toLocaleString() : 'Never'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${isOnline ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10 dark:text-emerald-400' : 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/10 dark:text-red-400'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                            AGENT NODE
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className={`grid grid-cols-3 gap-4 flex-1 ${!isOnline && 'opacity-50 grayscale transition-all'}`}>
                    {/* CPU */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border relative overflow-hidden">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1 z-10">
                            <Cpu className="w-3.5 h-3.5" /> CPU
                        </div>
                        <div className="z-10">{renderDonut(metrics.cpu_pct, '#60a5fa')}</div>
                    </div>

                    {/* RAM */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border relative overflow-hidden">
                        <div className="flex items-center gap-2 text-xs font-semibold text-purple-500 dark:text-purple-400 mb-1 z-10">
                            <Activity className="w-3.5 h-3.5" /> RAM
                        </div>
                        <div className="z-10">{renderDonut(metrics.mem_usage, '#c084fc')}</div>
                    </div>

                    {/* Disk */}
                    <div className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-b from-accent/50 to-transparent border border-border relative overflow-hidden">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500 dark:text-emerald-400 mb-1 z-10">
                            <HardDrive className="w-3.5 h-3.5" /> DISK
                        </div>
                        <div className="z-10">{renderDonut(metrics.disk_usage, '#34d399')}</div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Network className="w-3.5 h-3.5" />
                        <span>{formatBytes(metrics.net_rx)} ↓</span>
                        <span className="w-px h-3 bg-border" />
                        <span>{formatBytes(metrics.net_tx)} ↑</span>
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground/50">
                        {agent.id.split('-')[0]}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
