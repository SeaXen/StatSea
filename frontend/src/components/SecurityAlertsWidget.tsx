import { useState } from 'react';
import { Shield, AlertTriangle, Info, CheckCircle, Bell, Check, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurityAlerts, useResolveAlert } from '../hooks/useSecurity';

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
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [filterTimeframe, setFilterTimeframe] = useState<string>('24h');
    const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);

    const { data: alerts = [], isLoading: loading } = useSecurityAlerts({
        severity: filterSeverity,
        timeframe: filterTimeframe,
    }) as { data: SecurityAlert[]; isLoading: boolean };

    const resolveAlertMutation = useResolveAlert();

    const handleResolve = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        resolveAlertMutation.mutate(id);
        if (selectedAlert?.id === id) {
            setSelectedAlert(prev => prev ? { ...prev, is_resolved: true } : null);
        }
    };

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500 dark:text-orange-400" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
            default: return <Bell className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getSeverityStyles = (severity: string, isResolved: boolean) => {
        if (isResolved) return 'bg-accent/20 border-border opacity-60 grayscale';
        switch (severity) {
            case 'critical': return 'bg-red-500/10 border-red-500/20';
            case 'warning': return 'bg-orange-500/10 border-orange-500/20';
            case 'info': return 'bg-blue-500/10 border-blue-500/20';
            default: return 'bg-muted/50 border-border';
        }
    };

    const sortedAlerts = [...alerts].sort((a: SecurityAlert, b: SecurityAlert) => {
        if (a.is_resolved === b.is_resolved) return 0;
        return a.is_resolved ? 1 : -1;
    });

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-full flex flex-col relative">
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Security Alerts</h3>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value)}
                            className="bg-muted/50 border border-border text-xs rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50"
                        >
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                        </select>
                        <select
                            value={filterTimeframe}
                            onChange={(e) => setFilterTimeframe(e.target.value)}
                            className="bg-muted/50 border border-border text-xs rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50"
                        >
                            <option value="1h">1 Hour</option>
                            <option value="24h">24 Hours</option>
                            <option value="7d">7 Days</option>
                            <option value="30d">30 Days</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center flex-1">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
            ) : sortedAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
                    <CheckCircle className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No alerts found</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    <AnimatePresence>
                        {sortedAlerts.map((alert: SecurityAlert) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${getSeverityStyles(alert.severity, alert.is_resolved)} ${selectedAlert?.id === alert.id ? 'ring-1 ring-primary/50' : ''}`}
                                onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                        {getIcon(alert.severity)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <Clock className="w-3 h-3" />
                                                {new Date(alert.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    {!alert.is_resolved && (
                                        <button
                                            onClick={(e) => handleResolve(alert.id, e)}
                                            className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors flex-shrink-0"
                                            title="Resolve"
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {selectedAlert?.id === alert.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-2 pt-2 border-t border-border/50">
                                                <p className="text-xs text-muted-foreground">{alert.description}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    {alert.is_resolved ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Resolved</span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Active</span>
                                                    )}
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground capitalize">{alert.severity}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
