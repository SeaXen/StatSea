import { useEffect, useState } from 'react';
import { Wifi, ArrowDown, ArrowUp, Zap } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface SpeedtestResult {
    id: number;
    timestamp: string;
    ping: number;
    download: number;
    upload: number;
    server_name: string;
}

const SpeedtestWidget = () => {
    const [result, setResult] = useState<SpeedtestResult | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchLatest = async () => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SPEEDTEST}?limit=1`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    setResult(data[0]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch speedtest results", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLatest();
        const interval = setInterval(fetchLatest, 10000); // Poll every 10s

        const handleUpdate = () => {
            fetchLatest();
        }

        window.addEventListener('speedtest-update', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('speedtest-update', handleUpdate);
        };
    }, []);

    const formatSpeed = (bps: number) => {
        const mbps = bps / 1_000_000;
        return `${mbps.toFixed(1)} Mbps`;
    };

    if (loading && !result) return <div className="h-full w-full animate-pulse bg-white/5 rounded-xl" />;

    return (
        <div className="glass-card p-6 rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-blue-400" />
                    <span className="text-white font-medium">Speedtest</span>
                </div>
                <span className="text-xs text-gray-400">
                    {result ? new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No data'}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs uppercase tracking-wider">
                        <ArrowDown className="w-3 h-3" />
                        Download
                    </div>
                    <span className="text-xl font-bold text-white">{result ? formatSpeed(result.download) : '--'}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs uppercase tracking-wider">
                        <ArrowUp className="w-3 h-3" />
                        Upload
                    </div>
                    <span className="text-xl font-bold text-white">{result ? formatSpeed(result.upload) : '--'}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs uppercase tracking-wider">
                        <Zap className="w-3 h-3" />
                        Ping
                    </div>
                    <span className="text-xl font-bold text-white">{result ? `${result.ping.toFixed(0)} ms` : '--'}</span>
                </div>
            </div>

            {result?.server_name && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-gray-500">
                    <ServerIcon className="w-3 h-3" />
                    <span className="truncate">{result.server_name}</span>
                </div>
            )}
        </div>
    );
};

function ServerIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
            <line x1="6" x2="6.01" y1="6" y2="6" />
            <line x1="6" x2="6.01" y1="18" y2="18" />
        </svg>
    )
}

export default SpeedtestWidget;
