import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownLeft, Globe, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../config/axiosInstance';

interface Connection {
    ip: string;
    bytes: number;
    hits: number;
    last_seen: number;
    city: string;
    country: string;
    lat: number;
    lon: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(epoch: number): string {
    const diff = Math.floor(Date.now() / 1000 - epoch);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

export function ActiveConnectionsWidget() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchConnections = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            const res = await axiosInstance.get('/network/connections');
            const data: Connection[] = Array.isArray(res.data) ? res.data : [];
            // Sort by most recent and limit to top 6
            data.sort((a, b) => b.last_seen - a.last_seen);
            setConnections(data.slice(0, 6));
        } catch (err) {
            console.error('Failed to fetch connections:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchConnections();
        const interval = setInterval(() => fetchConnections(), 5000);
        return () => clearInterval(interval);
    }, [fetchConnections]);

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Active Connections</h3>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium uppercase tracking-wider">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Live
                    </span>
                    <button
                        onClick={() => fetchConnections(true)}
                        className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            <div className="space-y-0 text-sm">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    <div className="col-span-1" />
                    <div className="col-span-5">Destination</div>
                    <div className="col-span-3">Traffic</div>
                    <div className="col-span-3 text-right">Seen</div>
                </div>
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 border-b border-border last:border-0 border-dashed">
                            <div className="col-span-1 h-4 w-4 bg-muted animate-pulse rounded-full justify-self-center" />
                            <div className="col-span-5 h-3 w-32 bg-muted animate-pulse rounded" />
                            <div className="col-span-3 h-3 w-12 bg-muted animate-pulse rounded" />
                            <div className="col-span-3 h-3 w-16 bg-muted animate-pulse rounded justify-self-end" />
                        </div>
                    ))
                ) : connections.length === 0 ? (
                    <div className="text-muted-foreground text-center py-6 text-sm">
                        No external connections detected
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {connections.map((conn, i) => (
                            <motion.div
                                key={conn.ip}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.05 }}
                                className="grid grid-cols-12 gap-2 items-center p-2 hover:bg-muted/50 rounded-lg transition-colors border-b border-border last:border-0 border-dashed"
                            >
                                <div className="col-span-1 text-center">
                                    {conn.hits > 5 ?
                                        <ArrowDownLeft className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> :
                                        <ArrowUpRight className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                                    }
                                </div>
                                <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <span className="truncate text-foreground font-mono text-xs block">
                                            {conn.city && conn.country
                                                ? `${conn.city}, ${conn.country}`
                                                : conn.ip}
                                        </span>
                                        {conn.city && (
                                            <span className="text-[10px] text-muted-foreground font-mono truncate block">
                                                {conn.ip}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-3 text-muted-foreground font-mono text-xs">
                                    {formatBytes(conn.bytes)}
                                    <span className="text-[10px] text-muted-foreground/60 ml-1">
                                        ({conn.hits} hits)
                                    </span>
                                </div>
                                <div className="col-span-3 text-right font-mono text-foreground text-xs">
                                    {timeAgo(conn.last_seen)}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
