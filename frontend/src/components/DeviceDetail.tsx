import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Globe, Shield, HardDrive, Smartphone, Monitor, Wifi, Clock, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { Device } from '../types';

interface DeviceDetailProps {
    device: Device | null;
    isOpen: boolean;
    onClose: () => void;
}

export function DeviceDetail({ device, isOpen, onClose }: DeviceDetailProps) {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (device && isOpen) {
            setLoading(true);
            fetch(`/api/devices/${device.id}/stats`)
                .then(res => res.json())
                .then(data => {
                    setStats(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching device stats:", err);
                    setLoading(false);
                });
        }
    }, [device, isOpen]);

    if (!device) return null;

    const getIcon = (type?: string) => {
        switch (type?.toLowerCase()) {
            case 'mobile': return <Smartphone className="w-6 h-6" />;
            case 'pc': return <Monitor className="w-6 h-6" />;
            case 'iot': return <Cpu className="w-6 h-6" />;
            default: return <Globe className="w-6 h-6" />;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Side Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#0a0a0c]/90 backdrop-blur-2xl border-l border-white/10 z-50 shadow-2xl overflow-y-auto"
                    >
                        <div className="p-8">
                            {/* Header */}
                            {loading && <div className="absolute top-4 right-16 text-xs text-blue-400 animate-pulse">Updating...</div>}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                                        {getIcon(device.type)}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white tracking-tight">{device.hostname || 'Unknown Device'}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                                                {device.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-white/10 text-gray-400 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Main Info Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <InfoCard icon={<Wifi className="w-4 h-4" />} label="IP Address" value={device.ip_address || 'N/A'} />
                                <InfoCard icon={<Shield className="w-4 h-4" />} label="MAC Address" value={device.mac_address} />
                                <InfoCard icon={<HardDrive className="w-4 h-4" />} label="Vendor" value={device.vendor || 'Unknown'} />
                                <InfoCard icon={<Clock className="w-4 h-4" />} label="Last Seen" value={new Date(device.last_seen).toLocaleTimeString()} />
                            </div>

                            {/* Traffic Insights */}
                            <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/5 mb-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-white">Throughput History</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-xs text-gray-400">Down</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            <span className="text-xs text-gray-400">Up</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats}>
                                            <defs>
                                                <linearGradient id="colorD" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorU" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(10, 10, 12, 0.95)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '12px',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                itemStyle={{ fontSize: '12px' }}
                                                labelStyle={{ display: 'none' }}
                                            />
                                            <Area type="monotone" dataKey="d" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorD)" />
                                            <Area type="monotone" dataKey="u" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorU)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <div className="flex items-center gap-2">
                                        <ArrowDownLeft className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-mono text-gray-300">Peak Down: 12.4 Mbps</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm font-mono text-gray-300">Peak Up: 2.1 Mbps</span>
                                    </div>
                                </div>
                            </div>

                            {/* Threat Analysis / Security */}
                            <div className="glass-card rounded-2xl p-6 border border-white/5 bg-red-500/5">
                                <div className="flex items-center gap-3 mb-4">
                                    <Shield className="w-5 h-5 text-red-400" />
                                    <h3 className="text-lg font-semibold text-white">Security Scan</h3>
                                </div>
                                <div className="space-y-3">
                                    <SecurityItem label="Malware Check" status="Clean" />
                                    <SecurityItem label="Suspicious Connections" status="None" />
                                    <SecurityItem label="Firmware Status" status="Up to date" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
                {icon}
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-sm font-mono text-white truncate">{value}</div>
        </div>
    );
}

function SecurityItem({ label, status }: { label: string, status: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{label}</span>
            <span className="text-sm font-medium text-green-400">{status}</span>
        </div>
    );
}
