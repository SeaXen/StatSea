import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ActiveConnectionsWidget() {
    const [loading, setLoading] = useState(true);
    // Mock connections for UI visualization since packet-level flow data isn't exposed by API yet
    const connections = [
        { src: '192.168.1.105', dst: '142.250.xxx (Google)', protocol: 'HTTPS', size: '15 KB', type: 'out' },
        { src: '192.168.1.105', dst: '52.94.xxx (AWS)', protocol: 'TLS', size: '2 KB', type: 'out' },
        { src: '192.168.1.200', dst: '104.16.xxx (Cloudflare)', protocol: 'HTTPS', size: '45 KB', type: 'in' },
        { src: '192.168.1.110', dst: '23.235.xxx (Akamai)', protocol: 'TCP', size: '120 KB', type: 'in' },
        { src: '192.168.1.55', dst: '20.112.xxx (Azure)', protocol: 'HTTPS', size: '8 KB', type: 'out' },
    ];

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Active Connections</h3>
            <div className="space-y-0 text-sm">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    <div className="col-span-1"></div>
                    <div className="col-span-5">Destination</div>
                    <div className="col-span-3">Protocol</div>
                    <div className="col-span-3 text-right">Size/Rate</div>
                </div>
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 border-b border-border last:border-0 border-dashed">
                            <div className="col-span-1 h-4 w-4 bg-muted animate-pulse rounded-full justify-self-center" />
                            <div className="col-span-5 h-3 w-32 bg-muted animate-pulse rounded" />
                            <div className="col-span-3 h-3 w-12 bg-muted animate-pulse rounded" />
                            <div className="col-span-3 h-3 w-16 bg-muted animate-pulse rounded justify-self-end" />
                        </div>
                    ))
                ) : (
                    <AnimatePresence mode="popLayout">
                        {connections.map((conn, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: i * 0.05 }}
                                className="grid grid-cols-12 gap-2 items-center p-2 hover:bg-muted/50 rounded-lg transition-colors border-b border-border last:border-0 border-dashed"
                            >
                                <div className="col-span-1 text-center">
                                    {conn.type === 'out' ?
                                        <ArrowUpRight className="w-4 h-4 text-orange-500 dark:text-orange-400" /> :
                                        <ArrowDownLeft className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                    }
                                </div>
                                <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="truncate text-foreground font-mono text-xs">{conn.dst}</span>
                                </div>
                                <div className="col-span-3 text-muted-foreground font-mono text-xs">{conn.protocol}</div>
                                <div className="col-span-3 text-right font-mono text-foreground">{conn.size}</div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
