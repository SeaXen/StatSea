import { useState, useEffect } from 'react';
import { Search, Smartphone, Globe, Router, Laptop, Wifi, MoreVertical, LayoutGrid, LayoutList, Power } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { API_CONFIG } from '../config/apiConfig';
import axiosInstance from '../config/axiosInstance';
import { DeviceDetail } from './DeviceDetail';
import { Device, DeviceGroup } from '../types';
import { Skeleton, TableRowSkeleton } from './skeletons/WidgetSkeleton';
import { GroupManager } from './GroupManager';
import { Layers, Folder, Search as SearchIcon } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function DevicesPage() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
    const [filterGroupId, setFilterGroupId] = useState<number | 'all'>('all');
    const [groups, setGroups] = useState<DeviceGroup[]>([]);
    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

    // Selection state for detail view
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        // Load from cache initially
        const cachedDevices = localStorage.getItem('statsea_cache_devices');
        const cachedGroups = localStorage.getItem('statsea_cache_groups');
        if (cachedDevices) setDevices(JSON.parse(cachedDevices));
        if (cachedGroups) setGroups(JSON.parse(cachedGroups));

        const fetchDevices = async () => {
            try {
                const [devicesRes, groupsRes] = await Promise.all([
                    axiosInstance.get(API_CONFIG.ENDPOINTS.DEVICES.LIST),
                    axiosInstance.get(API_CONFIG.ENDPOINTS.DEVICES.GROUPS)
                ]);

                setDevices(devicesRes.data);
                setGroups(groupsRes.data);

                // Update cache
                localStorage.setItem('statsea_cache_devices', JSON.stringify(devicesRes.data));
                localStorage.setItem('statsea_cache_groups', JSON.stringify(groupsRes.data));
            } catch (error) {
                console.error("Error fetching data:", error);
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

    const wakeDevice = async (e: React.MouseEvent, mac: string) => {
        e.stopPropagation();
        try {
            await axiosInstance.post(API_CONFIG.ENDPOINTS.DEVICES.WAKE(mac));

            toast.success('Wake-on-LAN packet sent', {
                description: `Magic packet sent to ${mac}`
            });
        } catch (error: unknown) {
            console.error("WoL Error:", error);
            const err = error as { response?: { data?: { detail?: string } }; message?: string };
            toast.error('Failed to wake device', {
                description: err.response?.data?.detail || err.message || 'Unknown error'
            });
        }
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

        const matchesGroup = filterGroupId === 'all' || device.group_id === filterGroupId;

        return matchesSearch && matchesStatus && matchesGroup;


    });

    const getIcon = (type: string = 'Unknown') => {
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
                    <Skeleton className="h-9 w-64" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                <Skeleton className="h-16 w-full rounded-xl" />
                <div className="bg-[#0A0B0E] rounded-xl border border-white/5 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <TableRowSkeleton key={i} />
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
                    <button
                        onClick={() => setIsGroupManagerOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10 flex items-center gap-2"
                    >
                        <Layers className="w-4 h-4" />
                        Manage Groups
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

            <div className="relative bg-black/20 rounded-lg border border-white/10 flex items-center px-3 gap-2">
                <Folder className="w-4 h-4 text-gray-400" />
                <select
                    value={filterGroupId}
                    onChange={(e) => setFilterGroupId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-transparent text-sm text-gray-300 focus:outline-none appearance-none pr-4 [&>option]:bg-[#0A0B0E]"
                >
                    <option value="all">All Groups</option>
                    {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                </select>
            </div>

            <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 ml-auto">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    title="List View"
                >
                    <LayoutList className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    title="Grid View"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
            </div>


            {/* Device List */}
            {
                viewMode === 'list' ? (
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
                                                key={device.id || device.mac_address}
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
                                                    <div className="flex justify-end gap-2">
                                                        {!device.is_online && (
                                                            <button
                                                                onClick={(e) => wakeDevice(e, device.mac_address)}
                                                                className="p-2 hover:bg-green-500/10 rounded-lg transition-colors text-gray-400 hover:text-green-400"
                                                                title="Wake on LAN"
                                                            >
                                                                <Power className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                        {filteredDevices.length === 0 && (
                            <div className="p-8">
                                <EmptyState
                                    icon={SearchIcon}
                                    title="No devices found"
                                    description="No devices match your search criteria or filters."
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence mode='popLayout'>
                            {filteredDevices.map((device, index) => {
                                const Icon = getIcon(device.type);
                                return (
                                    <motion.div
                                        key={device.id || device.mac_address}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2, delay: index * 0.02 }}
                                        className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-5 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all cursor-pointer group relative overflow-hidden"
                                        onClick={() => openDetail(device)}
                                    >
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            {!device.is_online && (
                                                <button
                                                    onClick={(e) => wakeDevice(e, device.mac_address)}
                                                    className="p-1.5 rounded-full bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 transition-colors z-10"
                                                    title="Wake on LAN"
                                                >
                                                    <Power className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <div className={`w-2.5 h-2.5 mt-1.5 rounded-full ${device.is_online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-gray-500'}`} />
                                        </div>


                                        {/* Group Indicator */}
                                        {
                                            device.group_id && (
                                                <div className="absolute top-4 left-4">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full ring-2 ring-[#0A0B0E]"
                                                        style={{ backgroundColor: groups.find(g => g.id === device.group_id)?.color || '#3b82f6' }}
                                                        title={groups.find(g => g.id === device.group_id)?.name || 'Group'}
                                                    />
                                                </div>
                                            )
                                        }

                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-start justify-between pr-6">
                                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-medium text-white text-lg truncate pr-2 group-hover:text-blue-400 transition-colors">{device.hostname || 'Unknown Device'}</h3>
                                                <p className="text-sm text-gray-500 truncate">{device.vendor || 'Unknown Vendor'}</p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2 text-xs font-mono text-gray-400 mt-1">
                                                <div className="bg-black/20 rounded-md p-2 border border-white/5 flex justify-between items-center hover:border-white/10 transition-colors">
                                                    <span className="text-gray-500">IP</span>
                                                    <span className="text-gray-300">{device.ip_address || '-'}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-1">
                                                <div className="flex gap-4 text-xs">
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <span className="text-blue-400 font-bold">↓</span> {device.download || '0 KB/s'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <span className="text-purple-400 font-bold">↑</span> {device.upload || '0 KB/s'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        {
                            filteredDevices.length === 0 && (
                                <div className="col-span-full">
                                    <EmptyState
                                        icon={SearchIcon}
                                        title="No devices found"
                                        description="No devices match your search criteria or filters."
                                    />
                                </div>
                            )
                        }
                    </div >
                )
            }

            <DeviceDetail
                device={selectedDevice}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                onUpdate={(updatedDevice) => {
                    setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d));
                    setSelectedDevice(updatedDevice);
                }}
                groups={groups}
            />

            <GroupManager
                isOpen={isGroupManagerOpen}
                onClose={() => setIsGroupManagerOpen(false)}
                groups={groups}
                setGroups={setGroups}
            />
        </div >
    );
}
