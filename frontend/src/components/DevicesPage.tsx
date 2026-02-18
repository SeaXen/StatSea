import { useState, useEffect } from 'react';
import { Search, Smartphone, Globe, Router, Laptop, Wifi, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceDetail } from './DeviceDetail';
import { Device } from '../types';

export function DevicesPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');

    // Selection state for detail view
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await fetch('/api/devices');
                if (!response.ok) {
                    throw new Error('Failed to fetch devices');
                }
                const data = await response.json();
                setDevices(data);
            } catch (error) {
                console.error("Error fetching devices:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
        const interval = setInterval(fetchDevices, 5000);
        return () => clearInterval(interval);
    }, []);

    const openDetail = (device: Device) => {
        setSelectedDevice(device);
        setIsDetailOpen(true);
    };

    // ... (filteredDevices and other logic) ...

    const filteredDevices = devices.filter(device => {
        const matchesSearch =
            (device.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
            (device.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
            (device.ip_address?.includes(searchQuery) || false) ||
            device.mac_address.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'all'
            ? true
            : filterStatus === 'online' ? device.is_online : !device.is_online;

        return matchesSearch && matchesStatus;
    });

    const getIcon = (type: any = 'Unknown') => {
        switch ((type || 'Unknown').toLowerCase()) {
            case 'mobile': return Smartphone;
            case 'pc': return Laptop; // Laptop icon for PC
            case 'router': return Router;
            case 'iot': return Wifi;
            default: return Globe; // Globe as generic network device
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="h-9 w-64 bg-white/10 animate-pulse rounded-lg" />
                    <div className="flex gap-2">
                        <div className="h-10 w-32 bg-white/10 animate-pulse rounded-lg" />
                        <div className="h-10 w-32 bg-white/10 animate-pulse rounded-lg" />
                    </div>
                </div>
                <div className="h-16 w-full bg-white/5 border border-white/10 rounded-xl animate-pulse" />
                <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 py-4 px-6 border-b border-white/5">
                            <div className="h-10 w-10 rounded-lg bg-white/10 animate-pulse" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-[40%] bg-white/10 animate-pulse rounded" />
                                <div className="h-3 w-[20%] bg-white/10 animate-pulse rounded" />
                            </div>
                            <div className="h-4 w-[15%] bg-white/10 animate-pulse rounded" />
                            <div className="h-4 w-[20%] bg-white/10 animate-pulse rounded" />
                            <div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Device Management
                </h1>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10">
                        Scan Network
                    </button>
                    <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors border border-blue-500/20">
                        Add Device
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex gap-4 p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search devices by name, IP, MAC or vendor..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-gray-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                    {(['all', 'online', 'offline'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterStatus === status
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Device List */}
            <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-white/5 text-gray-400 border-b border-white/10">
                            <th className="p-4 font-medium">Device</th>
                            <th className="p-4 font-medium">IP Address</th>
                            <th className="p-4 font-medium">MAC Address</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Usage (Mock)</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        <AnimatePresence mode='popLayout'>
                            {filteredDevices.map((device, index) => {
                                const Icon = getIcon(device.type);
                                return (
                                    <motion.tr
                                        key={device.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: index * 0.03,
                                            ease: "easeOut"
                                        }}
                                        onClick={() => openDetail(device)}
                                        className="group hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white group-hover:text-blue-400 transition-colors">{device.hostname || 'Unknown Device'}</div>
                                                    <div className="text-xs text-gray-500">{device.vendor || 'Unknown Vendor'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300 font-mono text-xs">{device.ip_address || '-'}</td>
                                        <td className="p-4 text-gray-500 font-mono text-xs">{device.mac_address}</td>
                                        <td className="p-4">
                                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${device.is_online
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${device.is_online ? 'bg-green-500' : 'bg-gray-500'
                                                    }`} />
                                                {device.is_online ? 'Online' : 'Offline'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 text-xs">
                                                <span className="text-gray-400">↓ {device.download || '0 KB/s'}</span>
                                                <span className="text-gray-500">↑ {device.upload || '0 KB/s'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </AnimatePresence>
                    </tbody>
                </table>
                {filteredDevices.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No devices found matching your criteria.
                    </div>
                )}
            </div>

            <DeviceDetail
                device={selectedDevice}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                onUpdate={(updatedDevice) => {
                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d));
                    setSelectedDevice(updatedDevice);
                }}
            />
        </div>
    );
}
