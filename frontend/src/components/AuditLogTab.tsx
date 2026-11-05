import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Loader2, ChevronLeft, ChevronRight, Calendar, Activity, Edit3, Trash2, LogIn, Plus } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

interface AuditLog {
    id: number;
    action: string;
    resource_type: string;
    resource_id: string | null;
    details: string | null;
    timestamp: string;
    actor: {
        id: number;
        username: string;
        full_name: string | null;
    } | null;
}

interface PaginatedResponse {
    items: AuditLog[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export default function AuditLogTab() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filters
    const [actionFilter, setActionFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const perPage = 20;

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: perPage.toString()
            });

            if (actionFilter) params.append('action', actionFilter);
            if (startDate) params.append('start', new Date(startDate).toISOString());
            if (endDate) {
                // Set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                params.append('end', end.toISOString());
            }

            const response = await axiosInstance.get<PaginatedResponse>(`${API_CONFIG.ENDPOINTS.ADMIN.AUDIT_LOG}?${params.toString()}`);
            setLogs(response.data.items);
            setTotalPages(response.data.pages);
            setTotalItems(response.data.total);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, perPage, actionFilter, startDate, endDate]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'UPDATE': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'DELETE': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'LOGIN': return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20';
            default: return 'text-muted-foreground bg-secondary/50 border-border';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <Plus className="w-3 h-3" />;
            case 'UPDATE': return <Edit3 className="w-3 h-3" />;
            case 'DELETE': return <Trash2 className="w-3 h-3" />;
            case 'LOGIN': return <LogIn className="w-3 h-3" />;
            default: return <Activity className="w-3 h-3" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-base font-semibold text-text font-mono flex items-center gap-2 mb-1">
                            <Activity className="w-5 h-5 text-accent" />
                            System Audit Log
                        </h2>
                        <p className="text-xs text-faint font-mono">Review system events, administrative actions, and logins.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                            <select
                                aria-label="Filter audit logs by action"
                                className="pl-9 pr-8 py-1.5 rounded-[7px] border border-line bg-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent appearance-none font-mono text-xs text-text transition-colors"
                                value={actionFilter}
                                onChange={(e) => {
                                    setActionFilter(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All Actions</option>
                                <option value="CREATE">Create</option>
                                <option value="UPDATE">Update</option>
                                <option value="DELETE">Delete</option>
                                <option value="LOGIN">Login</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-raised border border-line rounded-[7px] px-3 py-1 font-mono text-xs text-text">
                            <Calendar className="w-3.5 h-3.5 text-faint" />
                            <input
                                aria-label="Start date"
                                type="date"
                                className="bg-transparent border-none text-xs font-mono outline-none w-[120px] text-text focus-visible:ring-1 focus-visible:ring-accent rounded"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                            <span className="text-faint">-</span>
                            <input
                                aria-label="End date"
                                type="date"
                                className="bg-transparent border-none text-xs font-mono outline-none w-[120px] text-text focus-visible:ring-1 focus-visible:ring-accent rounded"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="panel rounded-[var(--r-panel)] border border-line bg-panel overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-raised/95 border-b border-line text-faint font-mono text-[10px] uppercase">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Timestamp</th>
                                    <th className="px-4 py-2.5 font-medium">Action</th>
                                    <th className="px-4 py-2.5 font-medium">Actor</th>
                                    <th className="px-4 py-2.5 font-medium">Resource</th>
                                    <th className="px-4 py-2.5 font-medium w-1/3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-faint font-mono text-xs">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                                            <p>Loading audit logs…</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-faint font-mono text-xs">
                                            <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
                                            <p>No audit logs found matching criteria.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-raised/60 transition-colors group">
                                            <td className="px-4 py-2.5 whitespace-nowrap text-faint font-mono text-xs">
                                                {new Intl.DateTimeFormat(undefined, {
                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                }).format(new Date(log.timestamp))}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[10px] uppercase tracking-wider font-bold font-mono border ${getActionColor(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                    {log.action}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs">
                                                {log.actor ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[10px] font-bold">
                                                            {log.actor.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-text">{log.actor.full_name || log.actor.username}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-faint italic text-xs">System</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                <div className="flex flex-col font-mono text-xs">
                                                    <span className="font-medium text-text">{log.resource_type}</span>
                                                    {log.resource_id && (
                                                        <span className="text-[10px] text-faint">ID: {log.resource_id}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-mono text-text-soft break-words max-w-sm">
                                                {log.details ? (
                                                    <div className="bg-raised p-2 rounded-[6px] border border-line max-h-24 overflow-y-auto custom-scrollbar text-[11px]">
                                                        {log.details}
                                                    </div>
                                                ) : (
                                                    <span className="italic text-faint">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!isLoading && logs.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-line bg-raised flex items-center justify-between">
                            <div className="text-xs font-mono text-faint">
                                Showing <span className="font-medium text-text">{(page - 1) * perPage + 1}</span> to <span className="font-medium text-text">{Math.min(page * perPage, totalItems)}</span> of <span className="font-medium text-text">{totalItems}</span> entries
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    aria-label="Previous page"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-[7px] border border-line bg-panel hover:bg-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-mono px-3 py-1 bg-panel rounded-[7px] border border-line text-text">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Next page"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1.5 rounded-[7px] border border-line bg-panel hover:bg-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
