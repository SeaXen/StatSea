import { useState, useEffect, useMemo } from 'react';

import { RefreshCw } from 'lucide-react';
import { DeviceStatusLog } from '../types';

interface UptimeTimelineProps {
    deviceId: number;
}

type TimeRange = '24h' | '7d' | '30d';

export function UptimeTimeline({ deviceId }: UptimeTimelineProps) {
    const [range, setRange] = useState<TimeRange>('24h');
    const [logs, setLogs] = useState<DeviceStatusLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ uptimePercent: 0, onlineDuration: 0, offlineDuration: 0 });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const end = new Date();
            const start = new Date();

            if (range === '24h') start.setHours(start.getHours() - 24);
            if (range === '7d') start.setDate(start.getDate() - 7);
            if (range === '30d') start.setDate(start.getDate() - 30);

            const queryParams = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString(),
                limit: '1000'
            });

            const res = await fetch(`/api/devices/${deviceId}/uptime?${queryParams}`);
            if (!res.ok) throw new Error('Failed to fetch uptime logs');
            const data = await res.json();
            setLogs(data);
        } catch (error) {
            console.error("Error fetching uptime logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceId, range]);

    // Process logs into segments
    const segments = useMemo(() => {
        const now = new Date();
        const start = new Date();
        if (range === '24h') start.setHours(start.getHours() - 24);
        if (range === '7d') start.setDate(start.getDate() - 7);
        if (range === '30d') start.setDate(start.getDate() - 30);

        // Sort logs ascending for processing
        const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const timelineSegments: { start: number; end: number; status: 'online' | 'offline' }[] = [];

        // Find initial status (most recent log before start time) - naive approach: assume online if no prior logs, or check backend?
        // For now, let's just process available logs. 
        // Improvement: We should probably fetch one log BEFORE the start time to know the initial state.
        // But for this version, we will assume state based on the first log found within range or just 'unknown' before first log.

        let currentStatus: 'online' | 'offline' = 'online'; // Default assumption or need better logic
        let lastTime = start.getTime();

        // If we have logs, check the first one. If it's "offline", it means it WENT offline at that time.
        // So before that it was "online".

        if (sortedLogs.length > 0) {
            const firstLog = sortedLogs[0];
            // If first log is "offline", it means it was online before.
            // If first log is "online", it means it was offline before.
            currentStatus = firstLog.status === 'offline' ? 'online' : 'offline';
        }

        sortedLogs.forEach(log => {
            const logTime = new Date(log.timestamp).getTime();
            if (logTime < start.getTime()) return; // Should be filtered by backend but double check

            // Segment from lastTime to logTime
            if (logTime > lastTime) {
                timelineSegments.push({
                    start: lastTime,
                    end: logTime,
                    status: currentStatus
                });
            }

            // Update status and time
            currentStatus = log.status as 'online' | 'offline';
            lastTime = logTime;
        });

        // Add final segment to now
        if (now.getTime() > lastTime) {
            timelineSegments.push({
                start: lastTime,
                end: now.getTime(),
                status: currentStatus
            });
        }

        // Calculate stats
        let totalOnline = 0;
        let totalOffline = 0;
        timelineSegments.forEach(seg => {
            const duration = seg.end - seg.start;
            if (seg.status === 'online') totalOnline += duration;
            else totalOffline += duration;
        });

        const total = totalOnline + totalOffline;
        setStats({
            uptimePercent: total > 0 ? (totalOnline / total) * 100 : 100,
            onlineDuration: totalOnline,
            offlineDuration: totalOffline
        });

        return timelineSegments;
    }, [logs, range]);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground/90">Uptime Timeline</h3>
                    <div className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono">
                        {stats.uptimePercent.toFixed(2)}%
                    </div>
                </div>

                <div className="flex bg-white/5 rounded-lg p-0.5">
                    {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${range === r
                                ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground/80'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                    <button
                        onClick={() => fetchLogs()}
                        className="ml-1 px-2 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Timeline Visualization */}
            <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden flex w-full">
                {segments.map((seg, i) => {
                    const totalDuration = segments.reduce((acc, s) => acc + (s.end - s.start), 0);
                    const widthPercent = ((seg.end - seg.start) / totalDuration) * 100;

                    // Don't render tiny segments that might clutter (optional optimization)
                    if (widthPercent < 0.1) return null;

                    return (
                        <div
                            key={i}
                            className={`h-full border-r border-black/10 last:border-0 hover:brightness-110 transition-all cursor-help relative group ${seg.status === 'online' ? 'bg-emerald-500/80' : 'bg-red-500/80'
                                }`}
                            style={{ width: `${widthPercent}%` }}
                        >
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 min-w-[150px]">
                                <div className="bg-card border border-white/10 rounded-lg p-2 shadow-xl text-xs">
                                    <div className={`font-bold mb-1 ${seg.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                        {seg.status === 'online' ? 'Online' : 'Offline'}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {new Date(seg.start).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                    <div className="text-muted-foreground text-[10px] mt-1">
                                        Duration: {formatDuration(seg.end - seg.start)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {segments.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground italic">
                        No data for this period
                    </div>
                )}
            </div>

            {/* Legend / Stats */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                    <span>Online: {formatDuration(stats.onlineDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500/80" />
                    <span>Offline: {formatDuration(stats.offlineDuration)}</span>
                </div>
            </div>
        </div>
    );
}
