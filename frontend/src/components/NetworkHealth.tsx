import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

import { API_CONFIG } from '../config/apiConfig';

interface NetworkHealthData {
    score: number;
    status: 'Excellent' | 'Good' | 'Poor';
}

const NetworkHealth = () => {
    const [data, setData] = useState<NetworkHealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (error) {
                console.error("Failed to fetch network health", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 10000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Excellent': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'Good': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'Poor': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    if (loading) return <div className="h-10 w-32 animate-pulse bg-gray-800/50 rounded-xl" />;

    return (
        <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-4 border border-white/5 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-gray-300">NetHealth</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-white">{data?.score ?? 0}%</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(data?.status || 'Unknown')}`}>
                    {data?.status || 'Unknown'}
                </span>
            </div>
        </div>
    );
};

export default NetworkHealth;
