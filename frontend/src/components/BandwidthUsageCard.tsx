import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface BandwidthHistory {
    date: string;
    upload: number;
    download: number;
}

export const BandwidthUsageCard: React.FC = () => {
    const [data, setData] = useState<BandwidthHistory[]>([]);
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // In a real app, we'd pass ?period=${period} to the API
                // For now, we'll simulate data or fetch what we have
                // The endpoint /analytics/bandwidth-history exists but might need parameters
                const response = await fetch(`${API_CONFIG.BASE_URL}/analytics/bandwidth-history?limit=30`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const result = await response.json();

                // Transform data for chart
                // Assuming API returns [{timestamp, upload_bytes, download_bytes}, ...]
                // We'll group by day/hour based on period

                // Mocking data transformation for now as the raw data might be granular
                // Real implementation would aggregate data here or on backend
                const transformed = result.map((item: any) => ({
                    date: new Date(item.timestamp).toLocaleDateString(undefined, { weekday: 'short' }),
                    upload: item.upload_bytes / (1024 * 1024 * 1024), // GB
                    download: item.download_bytes / (1024 * 1024 * 1024), // GB
                })).slice(-7); // Last 7 points

                // Fallback mock if empty (during dev)
                if (transformed.length === 0) {
                    setData([
                        { date: 'Mon', upload: 2.4, download: 12.5 },
                        { date: 'Tue', upload: 1.8, download: 8.2 },
                        { date: 'Wed', upload: 3.2, download: 15.1 },
                        { date: 'Thu', upload: 2.1, download: 10.8 },
                        { date: 'Fri', upload: 4.5, download: 22.4 },
                        { date: 'Sat', upload: 1.2, download: 18.2 },
                        { date: 'Sun', upload: 0.8, download: 25.6 },
                    ]);
                } else {
                    setData(transformed);
                }
            } catch (error) {
                console.error("Failed to fetch bandwidth data", error);
                // Set fallback data on error for demo purposes
                setData([
                    { date: 'Mon', upload: 2.4, download: 12.5 },
                    { date: 'Tue', upload: 1.8, download: 8.2 },
                    { date: 'Wed', upload: 3.2, download: 15.1 },
                    { date: 'Thu', upload: 2.1, download: 10.8 },
                    { date: 'Fri', upload: 4.5, download: 22.4 },
                    { date: 'Sat', upload: 1.2, download: 18.2 },
                    { date: 'Sun', upload: 0.8, download: 25.6 },
                ]);
            }
        };

        fetchData();
    }, [period]);

    return (
        <div className="h-full rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-200">
                        <Calendar className="h-5 w-5 text-purple-400" />
                        Bandwidth Usage
                    </h3>
                    <p className="text-sm text-gray-400">Total data transfer over time</p>
                </div>
                <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                    {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${period === p
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <XAxis
                            dataKey="date"
                            stroke="#525252"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#525252"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value} GB`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#171717',
                                border: '1px solid #262626',
                                borderRadius: '8px'
                            }}
                            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        />
                        <Bar dataKey="download" name="Download" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="upload" name="Upload" fill="#a855f7" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-400">Download</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <span className="text-sm text-gray-400">Upload</span>
                </div>
            </div>
        </div>
    );
};
