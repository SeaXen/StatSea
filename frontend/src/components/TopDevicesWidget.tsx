import { useState, useEffect, useCallback } from 'react';
import { Laptop, Smartphone, Tv, RefreshCw } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';

interface TopDevice {
    mac: string;
    ip?: string;
    hostname?: string;
    upload: number;
    download: number;
    total: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Tiny inline SVG sparkline showing relative traffic share */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
    return (
        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden mt-1">
            <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color }}
            />
        </div>
    );
}

export function TopDevicesWidget() {
    const [devices, setDevices] = useState<TopDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTopDevices = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            const res = await axiosInstance.get('/analytics/summary');
            const topDevices: TopDevice[] = res.data?.top_devices ?? [];
            setDevices(topDevices.slice(0, 5));
        } catch (err) {
            console.error('Failed to fetch top devices:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTopDevices();
        const interval = setInterval(() => fetchTopDevices(), 10000);
        return () => clearInterval(interval);
    }, [fetchTopDevices]);

    const getIcon = (hostname: string = '') => {
        const h = hostname.toLowerCase();
        if (h.includes('phone') || h.includes('iphone') || h.includes('galaxy') || h.includes('pixel')) return <Smartphone className="w-4 h-4" />;
        if (h.includes('tv') || h.includes('roku') || h.includes('chromecast') || h.includes('fire')) return <Tv className="w-4 h-4" />;
        return <Laptop className="w-4 h-4" />;
    };

    const maxTraffic = devices.length > 0 ? devices[0].total : 1;

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Top Devices</h3>
                <div className="flex items-center gap-2">
                    {/* Live indicator */}
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium uppercase tracking-wider">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Live
                    </span>
                    <button
                        onClick={() => fetchTopDevices(true)}
                        className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            <div className="space-y-2">
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                                    <div className="h-2 w-16 bg-muted animate-pulse rounded" />
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="h-3 w-12 bg-muted animate-pulse rounded ml-auto" />
                                    <div className="h-2 w-16 bg-muted animate-pulse rounded ml-auto" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        {devices.map((device, i) => (
                            <div key={device.mac} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors shrink-0">
                                        {getIcon(device.hostname)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-foreground truncate">
                                            {device.hostname || device.ip || device.mac}
                                        </div>
                                        <MiniBar value={device.total} max={maxTraffic} color={`hsl(${220 - i * 15}, 70%, 55%)`} />
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className="text-sm font-mono text-foreground">{formatBytes(device.total)}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        ↑{formatBytes(device.upload)} ↓{formatBytes(device.download)}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {devices.length === 0 && (
                            <div className="text-muted-foreground text-center py-6 text-sm">
                                No device traffic detected yet
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
