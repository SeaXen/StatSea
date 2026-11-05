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
        return <div className="animate-pulse h-64 bg-raised rounded-[var(--r-panel)] border border-line" />;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Domains Card */}
                <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel lg:col-span-1">
                    <h3 className="text-base font-bold text-text mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-accent" />
                        Top Domains
                    </h3>
                    <div className="space-y-3">
                        {topDomains.map((item, index) => (
                            <div key={index} className="flex items-center justify-between font-mono text-xs">
                                <span className="text-text/80 truncate max-w-[70%]" title={item.domain}>
                                    {item.domain}
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 bg-line rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent rounded-full"
                                            style={{ width: `${(item.count / (topDomains[0]?.count || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-faint w-8 text-right tabular-nums">{item.count}</span>
                                </div>
                            </div>
                        ))}
                        {topDomains.length === 0 && (
                            <div className="text-faint text-center py-4 text-xs font-mono">No data available</div>
                        )}
                    </div>
                </div>

                {/* Recent Queries Log */}
                <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-base font-bold text-text flex items-center gap-2 whitespace-nowrap">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            DNS Queries
                        </h3>

                        <div className="flex items-center gap-2 w-full lg:max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                                <input
                                    type="text"
                                    placeholder="Search domain…"
                                    aria-label="Search DNS query domain"
                                    className="w-full bg-raised border border-line rounded-[7px] pl-8 pr-4 py-1.5 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors placeholder:text-faint font-mono"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <select
                                aria-label="Filter DNS queries by device"
                                className="bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors appearance-none outline-none font-mono"
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
                            <thead className="sticky top-0 bg-raised z-10 text-[10px] uppercase text-faint font-bold border-b border-line">
                                <tr>
                                    <th className="pb-2.5 pt-1 px-3">Time</th>
                                    <th className="pb-2.5 pt-1 px-3">Device</th>
                                    <th className="pb-2.5 pt-1 px-3">Type</th>
                                    <th className="pb-2.5 pt-1 px-3">Domain</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-line font-mono">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-raised/60 transition-colors">
                                        <td className="py-2.5 px-3 text-faint whitespace-nowrap tabular-nums">
                                            {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(log.timestamp))}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex flex-col">
                                                <span className="text-text font-bold">
                                                    {log.device_id ? deviceMap[log.device_id] : (log.client_ip || 'Internal')}
                                                </span>
                                                {log.device_id && log.client_ip && (
                                                    <span className="text-[10px] text-faint font-mono">
                                                        {log.client_ip}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded-[5px] text-[10px] font-bold tracking-wider ${log.record_type === 'A' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    log.record_type === 'AAAA' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                                        log.record_type === 'CNAME' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                            'bg-raised text-faint border border-line'
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
