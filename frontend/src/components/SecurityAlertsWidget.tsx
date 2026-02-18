import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Info, CheckCircle, Bell, X, Check, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

interface SecurityAlert {
    id: number;
    timestamp: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    is_resolved: boolean;
    device_id?: number;
}

export function SecurityAlertsWidget() {
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [filterTimeframe, setFilterTimeframe] = useState<string>('24h');
    const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterSeverity !== 'all') params.append('severity', filterSeverity);
            if (filterTimeframe !== 'all') params.append('timeframe', filterTimeframe);

            const response = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.SECURITY.ALERTS}?${params.toString()}`);
            setAlerts(response.data);
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, [filterSeverity, filterTimeframe]);

    const handleResolve = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await axiosInstance.patch(API_CONFIG.ENDPOINTS.SECURITY.RESOLVE(id));
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true } : a));
            if (selectedAlert?.id === id) {
                setSelectedAlert(prev => prev ? { ...prev, is_resolved: true } : null);
            }
        } catch (error) {
            console.error("Error resolving alert:", error);
        }
    };

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
            case 'info': return <Info className="w-4 h-4 text-blue-400" />;
            default: return <Bell className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSeverityStyles = (severity: string, isResolved: boolean) => {
        if (isResolved) return 'bg-white/5 border-white/5 opacity-60 grayscale';
        switch (severity) {
            case 'critical': return 'bg-red-500/10 border-red-500/20';
            case 'warning': return 'bg-orange-500/10 border-orange-500/20';
            case 'info': return 'bg-blue-500/10 border-blue-500/20';
            default: return 'bg-white/5 border-white/10';
        }
    };

    // Filter out resolved alerts from the main view unless specific filter? 
    // For now show all but resolved are dimmed.
    // Or maybe hide resolved? Let's show them for history but at the bottom.
    const sortedAlerts = [...alerts].sort((a, b) => {
        if (a.is_resolved === b.is_resolved) return 0;
        return a.is_resolved ? 1 : -1;
    });

    return (
        <div className="glass-card rounded-xl p-6 border border-white/5 bg-black/20 backdrop-blur-xl h-full flex flex-col relative">
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-lg font-semibold text-gray-200">Security Alerts</h3>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value)}
                            className="bg-black/30 border border-white/10 text-xs rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-indigo-500/50"
                        >
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                        </select>
                        <select
                            value={filterTimeframe}
                            onChange={(e) => setFilterTimeframe(e.target.value)}
                            className="bg-black/30 border border-white/10 text-xs rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-indigo-500/50"
                        >
                            <option value="1h">1 Hour</option>
                            <option value="24h">24 Hours</option>
                            <option value="7d">7 Days</option>
                            <option value="30d">30 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 animate-pulse">
                            <div className="h-4 w-2/3 bg-white/10 rounded mb-2"></div>
                            <div className="h-3 w-1/2 bg-white/10 rounded"></div>
                        </div>
                    ))
                ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
                        <CheckCircle className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No alerts found</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {sortedAlerts.map((alert) => (
                            <motion.div
                                key={alert.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`p-4 rounded-xl border ${getSeverityStyles(alert.severity, alert.is_resolved)} transition-all hover:bg-white/5 cursor-pointer group`}
                                onClick={() => setSelectedAlert(alert)}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0">
                                        {alert.is_resolved ? <CheckCircle className="w-4 h-4 text-green-500/50" /> : getIcon(alert.severity)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className={`text-sm font-medium truncate pr-2 ${alert.is_resolved ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                {alert.title}
                                            </h4>
                                            <span className="text-[10px] text-gray-500 whitespace-nowrap flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {alert.description}
                                        </p>

                                        {!alert.is_resolved && (
                                            <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleResolve(alert.id, e)}
                                                    className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-1 rounded-full transition-colors"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Resolve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedAlert && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-xl" onClick={() => setSelectedAlert(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0f1115] border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            <div className={`p-4 border-b border-white/5 flex items-center justify-between ${getSeverityStyles(selectedAlert.severity, selectedAlert.is_resolved).split(' ')[0]}`}>
                                <div className="flex items-center gap-2">
                                    {getIcon(selectedAlert.severity)}
                                    <h3 className="font-medium text-gray-200">{selectedAlert.title}</h3>
                                </div>
                                <button onClick={() => setSelectedAlert(null)} className="text-gray-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Description</label>
                                    <p className="text-sm text-gray-300 leading-relaxed">{selectedAlert.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Time</label>
                                        <p className="text-sm text-gray-300">{new Date(selectedAlert.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${selectedAlert.is_resolved ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedAlert.is_resolved ? 'bg-green-500' : 'bg-red-500'}`} />
                                            {selectedAlert.is_resolved ? 'Resolved' : 'Active'}
                                        </span>
                                    </div>
                                </div>
                                {!selectedAlert.is_resolved && (
                                    <button
                                        onClick={(e) => handleResolve(selectedAlert.id, e)}
                                        className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Mark as Resolved
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
