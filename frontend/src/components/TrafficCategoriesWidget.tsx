import React from 'react';
import { useTrafficCategories } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers, Activity } from 'lucide-react';

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const CATEGORY_COLORS: Record<string, string> = {
    'Netflix': '#e50914',
    'YouTube': '#ff0000',
    'Steam': '#171a21',
    'Facebook': '#1877f2',
    'Instagram': '#e1306c',
    'Amazon': '#ff9900',
    'Discord': '#5865f2',
    'Apple': '#a6b1b7',
    'Microsoft': '#00a4ef',
    'Spotify': '#1db954',
    'GitHub': '#333',
    'Twitter': '#1da1f2',
    'Twitch': '#9146ff',
    'Web Browsing': '#3b82f6',
    'Unknown': '#6b7280',
    'DNS': '#eab308',
    'SSH': '#14b8a6',
    'FTP': '#f43f5e'
};

const TrafficCategoriesWidget: React.FC<{ deviceId?: number }> = ({ deviceId }) => {
    const { data: categories, isLoading, isError } = useTrafficCategories(deviceId);

    if (isLoading) {
        return (
            <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px]">
                <Activity className="w-8 h-8 animate-pulse text-cyan-500 mb-2" />
                <span className="text-sm text-muted-foreground">Loading Analytics...</span>
            </div>
        );
    }

    if (isError || !categories) {
        return (
            <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
                <span className="text-sm">Unable to load traffic categories</span>
            </div>
        );
    }

    const chartData = categories.map((c: any) => ({
        name: c.category,
        total: c.download_bytes + c.upload_bytes,
        download: c.download_bytes,
        upload: c.upload_bytes,
        color: CATEGORY_COLORS[c.category] || '#6b7280'
    })).sort((a: any, b: any) => b.total - a.total);

    if (chartData.length === 0) {
        return (
            <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] text-muted-foreground">
                <Layers className="w-8 h-8 opacity-50 mb-2" />
                <span className="text-sm">No application traffic recorded yet</span>
            </div>
        );
    }

    return (
        <div className="bg-card/60 border border-border rounded-xl p-4 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Application Traffic (DPI)</h3>
            </div>

            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatBytes} stroke="#6b7280" fontSize={11} />
                        <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={11} tick={{ fill: '#d1d5db' }} width={80} />
                        <Tooltip
                            cursor={{ fill: '#1f2937' }}
                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ color: '#e5e7eb' }}
                            formatter={(value: number, name: string) => [formatBytes(value), name === 'total' ? 'Total Traffic' : name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrafficCategoriesWidget;
