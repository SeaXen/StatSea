import { useState, useEffect } from 'react';
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

    const fetchLogs = async () => {
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
    };

    useEffect(() => {
        fetchLogs();
    }, [page, actionFilter, startDate, endDate]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'UPDATE': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'DELETE': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'LOGIN': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
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
            <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-2xl font-semibold flex items-center gap-3 mb-1">
                            <Activity className="w-6 h-6 text-primary" />
                            System Audit Log
                        </h2>
                        <p className="text-muted-foreground">Review system events, administrative actions, and logins.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <select
                                className="pl-10 pr-8 py-2.5 rounded-xl border border-border/50 bg-card/50 focus:ring-2 focus:ring-primary/50 outline-none appearance-none font-medium text-sm transition-all"
                                value={actionFilter}
                                onChange={(e) => {
                                    setActionFilter(e.target.value);
                                    setPage(1); // Reset to first page
                                }}
                            >
                                <option value="">All Actions</option>
                                <option value="CREATE">Create</option>
                                <option value="UPDATE">Update</option>
                                <option value="DELETE">Delete</option>
                                <option value="LOGIN">Login</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <input
                                type="date"
                                className="bg-transparent border-none text-sm outline-none w-[130px] text-foreground"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                className="bg-transparent border-none text-sm outline-none w-[130px] text-foreground"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 border-b border-white/5 text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-4 font-medium whitespace-nowrap">Timestamp</th>
                                    <th className="px-6 py-4 font-medium">Action</th>
                                    <th className="px-6 py-4 font-medium">Actor</th>
                                    <th className="px-6 py-4 font-medium">Resource</th>
                                    <th className="px-6 py-4 font-medium w-1/3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                                            <p>Loading audit logs...</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            <Search className="w-8 h-8 mx-auto mb-4 opacity-50" />
                                            <p>No audit logs found matching criteria.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                                                {new Date(log.timestamp).toLocaleString(undefined, {
                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border ${getActionColor(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                    {log.action}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {log.actor ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                                                            {log.actor.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium">{log.actor.full_name || log.actor.username}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-xs">System</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground/90">{log.resource_type}</span>
                                                    {log.resource_id && (
                                                        <span className="text-xs text-muted-foreground font-mono">ID: {log.resource_id}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-muted-foreground break-words max-w-sm">
                                                {log.details ? (
                                                    <div className="bg-black/30 p-2 rounded border border-white/5 max-h-24 overflow-y-auto custom-scrollbar">
                                                        {log.details}
                                                    </div>
                                                ) : (
                                                    <span className="italic opacity-50">-</span>
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
                        <div className="px-6 py-4 border-t border-white/5 bg-white/5 flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{(page - 1) * perPage + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * perPage, totalItems)}</span> of <span className="font-medium text-foreground">{totalItems}</span> entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-border/50 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-medium px-4 py-2 bg-black/30 rounded-lg border border-white/5">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg border border-border/50 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
