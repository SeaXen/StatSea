import React from 'react';
import { Activity, Globe } from 'lucide-react';
import { useDnsLogs, useTopDomains } from '../hooks/useDns';

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
    const { data: logs = [], isLoading: logsLoading } = useDnsLogs(50) as { data: DnsLog[]; isLoading: boolean };
    const { data: topDomains = [], isLoading: topLoading } = useTopDomains(5) as { data: TopDomain[]; isLoading: boolean };
    const loading = logsLoading || topLoading;

    if (loading) return <div className="animate-pulse h-64 bg-gray-800/50 rounded-xl" />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Domains Card */}
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 lg:col-span-1">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    Top Domains
                </h3>
                <div className="space-y-3">
                    {topDomains.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <span className="text-gray-300 truncate max-w-[70%]">{item.domain}</span>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-24 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${(item.count / (topDomains[0]?.count || 1)) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400 w-8 text-right">{item.count}</span>
                            </div>
                        </div>
                    ))}
                    {topDomains.length === 0 && (
                        <div className="text-gray-500 text-center py-4">No data available</div>
                    )}
                </div>
            </div>

            {/* Recent Queries Log */}
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 lg:col-span-2 overflow-hidden flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    Recent DNS Queries
                </h3>
                <div className="overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-gray-900/90 backdrop-blur z-10 text-xs uppercase text-gray-500 font-medium">
                            <tr>
                                <th className="pb-2">Time</th>
                                <th className="pb-2">Client</th>
                                <th className="pb-2">Type</th>
                                <th className="pb-2">Domain</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-700/50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-2 text-gray-400 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="py-2 text-blue-300 font-mono text-xs">{log.client_ip}</td>
                                    <td className="py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.record_type === 'A' ? 'bg-green-500/20 text-green-300' :
                                            log.record_type === 'AAAA' ? 'bg-purple-500/20 text-purple-300' :
                                                log.record_type === 'CNAME' ? 'bg-yellow-500/20 text-yellow-300' :
                                                    'bg-gray-600/30 text-gray-300'
                                            }`}>
                                            {log.record_type}
                                        </span>
                                    </td>
                                    <td className="py-2 text-gray-200 truncate max-w-[200px]" title={log.query_domain}>
                                        {log.query_domain}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-gray-500">
                                        No DNS queries captured yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DnsQueryLog;
