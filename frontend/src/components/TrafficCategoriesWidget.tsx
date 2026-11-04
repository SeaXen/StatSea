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

export interface TrafficCategory {
    category: string;
    download_bytes: number;
    upload_bytes: number;
    [key: string]: unknown;
}

interface TrafficCategoryChartPoint {
    name: string;
    total: number;
    download: number;
    upload: number;
    color: string;
}

const TrafficCategoriesWidget: React.FC<{ deviceId?: number }> = ({ deviceId }) => {
    const { data: categories, isLoading, isError } = useTrafficCategories(deviceId);

    if (isLoading) {
        return (
            <div className="panel border border-line rounded-[var(--r-panel)] p-4 flex flex-col items-center justify-center min-h-[300px] bg-panel">
                <Activity className="w-6 h-6 animate-pulse text-accent mb-2" />
                <span className="text-xs font-mono text-faint">Loading Analytics...</span>
            </div>
        );
    }

    if (isError || !categories) {
        return (
            <div className="panel border border-line rounded-[var(--r-panel)] p-4 flex flex-col items-center justify-center min-h-[300px] text-faint bg-panel font-mono text-xs">
                <span>Unable to load traffic categories</span>
            </div>
        );
    }

    const chartData: TrafficCategoryChartPoint[] = (Array.isArray(categories) ? (categories as TrafficCategory[]) : []).map((c: TrafficCategory) => ({
        name: c.category,
        total: (c.download_bytes || 0) + (c.upload_bytes || 0),
        download: c.download_bytes || 0,
        upload: c.upload_bytes || 0,
        color: CATEGORY_COLORS[c.category] || '#6b7280'
    })).sort((a: TrafficCategoryChartPoint, b: TrafficCategoryChartPoint) => b.total - a.total);

    if (chartData.length === 0) {
        return (
            <div className="panel border border-line rounded-[var(--r-panel)] p-4 flex flex-col items-center justify-center min-h-[300px] text-faint bg-panel font-mono text-xs">
                <Layers className="w-6 h-6 opacity-40 mb-2" />
                <span>No application traffic recorded yet</span>
            </div>
        );
    }

    return (
        <div className="panel border border-line rounded-[var(--r-panel)] p-4 flex flex-col h-full bg-panel">
            <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-text font-mono">Application Traffic (DPI)</h3>
            </div>

            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatBytes} stroke="var(--faint)" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="var(--faint)" fontSize={10} tick={{ fill: 'var(--text)' }} width={80} />
                        <Tooltip
                            cursor={{ fill: 'var(--raised)' }}
                            contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--line)', borderRadius: '8px', fontSize: '11px', color: 'var(--text)' }}
                            itemStyle={{ color: 'var(--text)' }}
                            formatter={(value: number, name: string) => [formatBytes(value), name === 'total' ? 'Total Traffic' : name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index: number) => (
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
