import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Info, CheckCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityAlert {
    id: number;
    timestamp: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    is_resolved: boolean;
}

export function SecurityAlertsWidget() {
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const response = await fetch('http://localhost:21081/security/events');
                if (response.ok) {
                    const data = await response.json();
                    const mapped = data.map((e: any) => ({
                        id: e.id,
                        timestamp: String(e.timestamp),
                        severity: e.severity.toLowerCase(),
                        title: e.event_type,
                        description: e.description,
                        is_resolved: e.resolved
                    }));
                    setAlerts(mapped);
                }
            } catch (error) {
                console.error("Error fetching alerts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
        // Periodically refresh if needed, but primary updates should come from WS
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
            case 'info': return <Info className="w-4 h-4 text-blue-400" />;
            default: return <Bell className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/10 border-red-500/20';
            case 'warning': return 'bg-orange-500/10 border-orange-500/20';
            case 'info': return 'bg-blue-500/10 border-blue-500/20';
            default: return 'bg-white/5 border-white/10';
        }
    };

    return (
        <div className="glass-card rounded-xl p-6 border border-white/5 bg-black/20 backdrop-blur-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-gray-200">Security Events</h3>
                </div>
                {alerts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                        Live
                    </span>
                )}
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
                        <p className="text-sm">Network secure. No recent alerts.</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {alerts.map((alert, i) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.05 }}
                                className={`p-4 rounded-xl border ${getSeverityStyles(alert.severity)} transition-all hover:scale-[1.01]`}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0">
                                        {getIcon(alert.severity)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-medium text-gray-200 truncate pr-2">{alert.title}</h4>
                                            <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {alert.description}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
