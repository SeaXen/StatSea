import React, { useState, useMemo } from 'react';
import { Activity, Globe, Search } from 'lucide-react';
import { useDnsLogs, useTopDomains } from '../hooks/useDns';
import { useDevices } from '../hooks/useDevices';
import { Device } from '../types';

interface DnsLog {
    id: number;
    timestamp: string;
    client_ip: string;
    query_domain: string;
    record_type: string;
    device_id?: number;
}

interface TopDomain {
    domain: string;
    count: number;
}

const DnsQueryLog: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | undefined>(undefined);

    const { data: devices = [] } = useDevices() as { data: Device[] };
    const { data: logsData, isLoading: logsLoading } = useDnsLogs(100, selectedDeviceId, searchQuery) as { data: { items: DnsLog[] }; isLoading: boolean };
    const { data: topDomains = [], isLoading: topLoading } = useTopDomains(5) as { data: TopDomain[]; isLoading: boolean };

    const logs = logsData?.items || [];
    const loading = logsLoading || topLoading;

    // Map device IDs to nicknames/hostnames
    const deviceMap = useMemo(() => {
        const map: Record<number, string> = {};
        devices.forEach(d => {
            map[d.id] = d.nickname || d.hostname || d.ip_address || 'Unknown';
        });
        return map;
    }, [devices]);

    if (loading && !logs.length && !topDomains.length) {
        return <div className="animate-pulse h-64 bg-secondary/50 rounded-xl" />;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Domains Card */}
                <div className="bg-secondary/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 lg:col-span-1">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-400" />
                        Top Domains
                    </h3>
                    <div className="space-y-3">
                        {topDomains.map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <span className="text-foreground/80 truncate max-w-[70%]" title={item.domain}>
                                    {item.domain}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${(item.count / (topDomains[0]?.count || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-8 text-right">{item.count}</span>
                                </div>
                            </div>
                        ))}
                        {topDomains.length === 0 && (
                            <div className="text-muted-foreground text-center py-4">No data available</div>
                        )}
                    </div>
                </div>

                {/* Recent Queries Log */}
                <div className="bg-secondary/50 backdrop-blur-xl border border-border/50 rounded-xl p-6 lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 whitespace-nowrap">
                            <Activity className="w-5 h-5 text-green-400" />
                            DNS Queries
                        </h3>

                        <div className="flex items-center gap-2 w-full lg:max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search domain..."
                                    className="w-full bg-secondary/50 border border-border/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <select
                                className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none outline-none"
                                value={selectedDeviceId || ''}
                                onChange={(e) => setSelectedDeviceId(e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">All Devices</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.nickname || d.hostname || d.ip_address}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#0f172a] z-10 text-xs uppercase text-muted-foreground font-medium">
                                <tr>
                                    <th className="pb-2">Time</th>
                                    <th className="pb-2">Device</th>
                                    <th className="pb-2">Type</th>
                                    <th className="pb-2">Domain</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-border/50">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </td>
                                        <td className="py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-blue-300 font-medium">
                                                    {log.device_id ? deviceMap[log.device_id] : (log.client_ip || 'Internal')}
                                                </span>
                                                {log.device_id && log.client_ip && (
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {log.client_ip}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${log.record_type === 'A' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                    log.record_type === 'AAAA' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                        log.record_type === 'CNAME' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                            'bg-secondary/30 text-foreground/80'
                                                }`}>
                                                {log.record_type}
                                            </span>
                                        </td>
                                        <td className="py-2.5 text-foreground/90 truncate max-w-[250px]" title={log.query_domain}>
                                            {log.query_domain}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && !logsLoading && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Globe className="w-8 h-8 opacity-20" />
                                                <p>No DNS queries found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DnsQueryLog;
