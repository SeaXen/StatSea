import { useState, useEffect } from 'react';
import { Laptop, Smartphone, Tv } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

export function TopDevicesWidget() {
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDevices = () => {
            fetch(API_CONFIG.ENDPOINTS.DEVICES)
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

    const getIcon = (vendor: any = '', type: any = '') => {
        const v = (vendor || '').toLowerCase();
        const t = (type || '').toLowerCase();
        if (t === 'mobile' || v.includes('apple') || v.includes('samsung') || v.includes('pixel') || v.includes('phone')) return <Smartphone className="w-4 h-4" />;
        if (t === 'iot' || v.includes('tv') || v.includes('amazon') || v.includes('roku') || v.includes('google')) return <Tv className="w-4 h-4" />;
        return <Laptop className="w-4 h-4" />;
    };

    return (
        <div className="glass-card rounded-xl p-6 border border-white/5 bg-black/20 backdrop-blur-xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Top Devices</h3>
            <div className="space-y-3">
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-3 w-full">
                                <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-3 w-24 bg-white/10 animate-pulse rounded" />
                                    <div className="h-2 w-16 bg-white/10 animate-pulse rounded" />
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="h-3 w-12 bg-white/10 animate-pulse rounded ml-auto" />
                                    <div className="h-2 w-16 bg-white/10 animate-pulse rounded ml-auto" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        {devices.slice(0, 5).map((device, i) => (
                            <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                        {getIcon(device.vendor, device.type)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-200">{device.hostname || device.ip_address || device.ip}</div>
                                        <div className="text-xs text-gray-400 font-mono">{device.vendor || 'Unknown Vendor'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono text-gray-300">{Math.floor(Math.random() * 10)}.{Math.floor(Math.random() * 9)} GB</div>
                                    <div className="text-xs text-green-400">↑ {Math.floor(Math.random() * 50)} Mbps</div>
                                </div>
                            </div>
                        ))}
                        {devices.length === 0 && <div className="text-gray-500 text-center py-6">Connecting to detector...</div>}
                    </>
                )}
            </div>
        </div>
    );
}
