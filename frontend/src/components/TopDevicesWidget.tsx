import { useState, useEffect } from 'react';
import { Laptop, Smartphone, Tv } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface Device {
    vendor?: string;
    type?: string;
    hostname?: string;
    ip_address?: string;
    ip?: string;
}

export function TopDevicesWidget() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDevices = () => {
            fetch(API_CONFIG.ENDPOINTS.DEVICES.LIST)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setDevices(data);
                })
                .catch(err => console.error("Failed to fetch devices", err))
                .finally(() => setLoading(false));
        };

        fetchDevices();
        const interval = setInterval(fetchDevices, 10000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (vendor: string = '', type: string = '') => {
        const v = (vendor || '').toLowerCase();
        const t = (type || '').toLowerCase();
        if (t === 'mobile' || v.includes('apple') || v.includes('samsung') || v.includes('pixel') || v.includes('phone')) return <Smartphone className="w-4 h-4" />;
        if (t === 'iot' || v.includes('tv') || v.includes('amazon') || v.includes('roku') || v.includes('google')) return <Tv className="w-4 h-4" />;
        return <Laptop className="w-4 h-4" />;
    };

    const [deviceStats, setDeviceStats] = useState<{ gb: string; mbps: number }[]>([]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDeviceStats(devices.slice(0, 5).map(() => ({
            gb: `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 9)}`,
            mbps: Math.floor(Math.random() * 50),
        })));
    }, [devices]);

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Top Devices</h3>
            <div className="space-y-3">
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
                        {devices.slice(0, 5).map((device, i) => (
                            <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                                        {getIcon(device.vendor, device.type)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">{device.hostname || device.ip_address || device.ip}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{device.vendor || 'Unknown Vendor'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono text-foreground">{deviceStats[i]?.gb ?? '0.0'} GB</div>
                                    <div className="text-xs text-green-500 dark:text-green-400">↑ {deviceStats[i]?.mbps ?? 0} Mbps</div>
                                </div>
                            </div>
                        ))}
                        {devices.length === 0 && <div className="text-muted-foreground text-center py-6">Connecting to detector...</div>}
                    </>
                )}
            </div>
        </div>
    );
}
