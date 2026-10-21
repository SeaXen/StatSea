import React, { useState } from 'react';
import {
    Search, Smartphone, Globe, Router, Laptop, Wifi, MoreVertical,
    LayoutGrid, LayoutList, Power, Layers, Activity, Zap, BarChart3, SortDesc,
    Cast, Server, HelpCircle, Download, FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useDevices, useDeviceGroups, useWakeDevice } from '../hooks/useDevices';
import axiosInstance from '../config/axiosInstance';
import { DeviceDetail } from './DeviceDetail';
import { Device, DeviceGroup } from '../types';
import { Skeleton, TableRowSkeleton } from './skeletons/WidgetSkeleton';
import { GroupManager } from './GroupManager';
import { EmptyState } from './EmptyState';
import { PremiumCard } from './ui/PremiumCard';
import { CustomSelect } from './ui/CustomSelect';
import { cn } from '../lib/utils';

interface DevicesPageProps {
    onDeviceHistory?: (mac: string) => void;
}

export function DevicesPage({ onDeviceHistory }: DevicesPageProps = {}) {
    const { data: devices = [], isLoading: loadingDevices } = useDevices();
    const { data: groups = [], isLoading: loadingGroups } = useDeviceGroups();
    const wakeDeviceMutation = useWakeDevice();
    const loading = loadingDevices || loadingGroups;

    const [searchQuery, setSearchQuery] = useState('');

    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
    const [filterGroupId, setFilterGroupId] = useState<number | 'all'>('all');

    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

    // Selection state for detail view
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [sortBy, setSortBy] = useState<'status' | 'bandwidth'>('status');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (resource: 'devices' | 'traffic', format: 'csv' | 'json') => {
        setIsExporting(true);
        try {
            const response = await axiosInstance.get(`/reports/export/${resource}`, {
                params: { format },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statsea_${resource}_${new Date().toISOString().split('T')[0]}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Export successful', {
                description: `Your ${resource} data has been exported as ${format.toUpperCase()}`
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed', {
                description: 'Could not generate export file'
            });
        } finally {
            setIsExporting(false);
        }
    };

    const openDetail = (device: Device) => {
        setSelectedDevice(device);
        setIsDetailOpen(true);

    };

    const wakeDevice = async (e: React.MouseEvent, mac: string) => {
        e.stopPropagation();
        try {
            await wakeDeviceMutation.mutateAsync(mac);
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

    const filteredDevices = devices.filter((device: Device) => {
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
    }).sort((a: Device, b: Device) => {
        if (sortBy === 'status') {
            return (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0);
        } else {
            // Very basic parse of bandwidth strings like "1.5 MB/s" or "500 KB/s"
            const parseBW = (bw: string | undefined) => {
                if (!bw) return 0;
                const match = bw.match(/([\d.]+)\s*(KB|MB|GB)\/s/i);
                if (match) {
                    const val = parseFloat(match[1]);
                    const unit = match[2].toUpperCase();
                    if (unit === 'KB') return val * 1024;
                    if (unit === 'MB') return val * 1024 * 1024;
                    if (unit === 'GB') return val * 1024 * 1024 * 1024;
                    return val;
                }
                return 0;
            };
            const aTotal = parseBW(a.download) + parseBW(a.upload);
            const bTotal = parseBW(b.download) + parseBW(b.upload);
            return bTotal - aTotal;
        }
    });

    const getIcon = (type: string = 'Unknown', iconType?: string) => {
        if (iconType) {
            switch (iconType) {
                case 'smartphone': return Smartphone;
                case 'router': return Router;
                case 'cast': return Cast;
                case 'computer': return Laptop;
                case 'server': return Server;
                case 'help': return HelpCircle;
            }
        }
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
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-4">
                <div className="space-y-1">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                            <Activity className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-foreground tracking-tighter flex items-center gap-3">
                                Device <span className="text-primary">Fleet</span>
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{filteredDevices.filter((d: any) => d.is_online || d.status === 'online').length} Online</span>
                                </div>
                                <span className="text-muted-foreground/40 text-[10px] font-bold uppercase tracking-widest leading-none">•</span>
                                <p className="text-muted-foreground font-medium text-sm tracking-tight">{filteredDevices.length} Total Managed Units</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center gap-3"
                >
                    <div className="flex bg-secondary/50 p-1 rounded-2xl border border-border shadow-sm overflow-hidden">
                        <button
                            onClick={() => handleExport('devices', 'csv')}
                            disabled={isExporting}
                            className="px-4 py-2 hover:bg-secondary rounded-xl text-[10px] font-black text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 group/btn disabled:opacity-50"
                        >
                            <Download className="w-3.5 h-3.5 text-primary group-hover/btn:scale-110 transition-transform" />
                            CSV
                        </button>
                        <div className="w-[1px] bg-border my-2" />
                        <button
                            onClick={() => handleExport('devices', 'json')}
                            disabled={isExporting}
                            className="px-4 py-2 hover:bg-secondary rounded-xl text-[10px] font-black text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 group/btn disabled:opacity-50"
                        >
                            <FileJson className="w-3.5 h-3.5 text-cyan-500 group-hover/btn:scale-110 transition-transform" />
                            JSON
                        </button>
                    </div>

                    <button className="px-5 py-3 bg-secondary/60 hover:bg-secondary rounded-2xl text-[10px] font-black text-foreground transition-all border border-border flex items-center gap-3 group/btn hover:border-primary/30 shadow-sm overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                        <Zap className="w-4 h-4 text-amber-500 group-hover/btn:scale-110 transition-transform" />
                        SCAN NETWORK
                    </button>
                    <button
                        onClick={() => setIsGroupManagerOpen(true)}
                        className="px-5 py-3 bg-secondary/60 hover:bg-secondary rounded-2xl text-xs font-black text-foreground transition-all border border-border flex items-center gap-3 group/btn hover:border-primary/30 shadow-sm"
                    >
                        <Layers className="w-4 h-4 text-primary group-hover/btn:scale-110 transition-transform" />
                        GROUPS
                    </button>
                    <button className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-xs font-black transition-all shadow-md hover:scale-[1.03] active:scale-[0.97] uppercase tracking-widest">
                        Add Device
                    </button>
                </motion.div>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col md:flex-row gap-6 items-center"
            >
                <div className="relative flex-1 group w-full">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search devices by name, IP, MAC or vendor..."
                        className="w-full bg-card/70 backdrop-blur-md border border-border rounded-3xl pl-14 pr-6 py-4 text-base text-foreground focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 focus:ring-4 focus:ring-primary/10 shadow-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <CustomSelect
                            label="Filter"
                            options={[
                                { value: 'all', label: 'All Status' },
                                { value: 'online', label: 'Online' },
                                { value: 'offline', label: 'Offline' }
                            ]}
                            value={filterStatus}
                            onChange={(val) => setFilterStatus(val as any)}
                        />

                        <CustomSelect
                            label="Group"
                            options={[
                                { value: 'all', label: 'All Groups' },
                                ...groups.map((g: DeviceGroup) => ({ value: String(g.id), label: g.name }))
                            ]}
                            value={String(filterGroupId)}
                            onChange={(val) => setFilterGroupId(val === 'all' ? 'all' : Number(val))}
                        />
                    </div>

                    <div className="h-10 w-[1px] bg-border hidden md:block" />

                    <div className="flex bg-card/70 backdrop-blur-md rounded-2xl p-1.5 border border-border shadow-sm">
                        <button
                            onClick={() => setSortBy(sortBy === 'status' ? 'bandwidth' : 'status')}
                            className="px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Sort by ${sortBy === 'status' ? 'Bandwidth' : 'Status'}`}
                            title={`Sort by ${sortBy === 'status' ? 'Bandwidth' : 'Status'}`}
                        >
                            <SortDesc className={cn("w-4 h-4", sortBy === 'bandwidth' ? "text-primary" : "text-muted-foreground")} />
                        </button>
                    </div>

                    <div className="flex bg-card/70 backdrop-blur-md rounded-2xl p-1.5 border border-border shadow-sm">
                        <button
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            className={cn(
                                "px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                viewMode === 'list'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            <LayoutList className="w-4 h-4" />
                            <span className="hidden sm:inline">LIST</span>
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid view"
                            className={cn(
                                "px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                viewMode === 'grid'
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="hidden sm:inline">GRID</span>
                        </button>
                    </div>
                </div>
            </motion.div>




            {/* Device List */}
            {viewMode === 'list' ? (
                <PremiumCard
                    className="p-0 border-none bg-[#111114]/30 backdrop-blur-2xl shadow-2xl overflow-hidden"
                    hover={false}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-white/[0.03] text-white/30 uppercase tracking-[0.2em] text-[9px] font-black border-b border-white/5">
                                    <th className="px-8 py-5 font-black border-b border-white/5">DEVICE IDENTITY</th>
                                    <th className="px-8 py-5 font-black border-b border-white/5">NETWORK INTERFACE</th>
                                    <th className="px-8 py-5 font-black border-b border-white/5 text-center">STATUS</th>
                                    <th className="px-8 py-5 font-black border-b border-white/5 text-center">BANDWIDTH USAGE</th>
                                    <th className="px-8 py-5 font-black border-b border-white/5 text-right">CONTROLS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                <AnimatePresence mode='popLayout'>
                                    {filteredDevices.map((device: Device, index: number) => {
                                        const Icon = getIcon(device.type, device.icon_type);
                                        return (
                                            <motion.tr
                                                key={device.id || device.mac_address}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: index * 0.02,
                                                    ease: [0.23, 1, 0.32, 1]
                                                }}
                                                onClick={() => openDetail(device)}
                                                className="group hover:bg-white/[0.04] cursor-pointer transition-all relative border-b border-white/[0.02] last:border-none"
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm group-hover:scale-110 transition-transform duration-500">
                                                            <Icon className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-foreground text-base group-hover:text-primary transition-colors tracking-tight">{device.hostname || 'Unknown Device'}</div>
                                                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">{device.vendor || 'Unknown Vendor'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <Globe className="w-3 h-3 text-muted-foreground" />
                                                            <code className="text-primary/90 font-mono text-xs tabular-nums tracking-wide">{device.ip_address || '---'}</code>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                                            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{device.mac_address}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex justify-center">
                                                        <div className={cn(
                                                            "inline-flex items-center px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] border transition-all duration-500",
                                                            device.is_online
                                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]'
                                                                : 'bg-secondary text-muted-foreground border-border'
                                                        )}>
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full mr-2.5",
                                                                device.is_online ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-muted-foreground/30'
                                                            )} />
                                                            {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex items-center gap-6 text-[11px] font-mono font-bold tabular-nums">
                                                            <div className="flex flex-col items-center gap-1 text-emerald-500">
                                                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">DL</span>
                                                                <span>↓ {device.download || '0 KB/s'}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1 text-primary">
                                                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">UL</span>
                                                                <span>↑ {device.upload || '0 KB/s'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 group-focus-within:translate-x-0">
                                                        {onDeviceHistory && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDeviceHistory(device.mac_address); }}
                                                                className="w-10 h-10 flex items-center justify-center bg-primary/10 hover:bg-primary/20 rounded-xl transition-all text-primary border border-primary/20 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                                aria-label={`Bandwidth history for ${device.hostname || device.mac_address}`}
                                                                title="Bandwidth History"
                                                            >
                                                                <BarChart3 className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        {!device.is_online && (
                                                            <button
                                                                onClick={(e) => wakeDevice(e, device.mac_address)}
                                                                className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-all text-emerald-500 border border-emerald-500/20 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                                aria-label={`Wake ${device.hostname || device.mac_address}`}
                                                                title="Wake on LAN"
                                                            >
                                                                <Power className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        <button 
                                                            className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-secondary/80 rounded-xl transition-all text-muted-foreground hover:text-foreground border border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                            aria-label="More options"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                    {filteredDevices.length === 0 && (
                        <div className="p-12">
                            <EmptyState
                                title="No devices found"
                                description="No devices match your search criteria or filters across your network."
                                icon={Search}
                            />
                        </div>
                    )}
                </PremiumCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence mode='popLayout'>
                        {filteredDevices.map((device: Device, index: number) => {
                            const Icon = getIcon(device.type, device.icon_type);
                            return (
                                <PremiumCard
                                    key={device.id || device.mac_address}
                                    delay={index * 0.04}
                                    className="p-8 transition-all bg-card/75 backdrop-blur-3xl group flex flex-col relative overflow-hidden border border-border/70 hover:border-primary/40 shadow-xl"
                                    onClick={() => openDetail(device)}
                                >
                                    <div className="absolute top-0 right-0 p-5 flex gap-2">
                                        {onDeviceHistory && (
                                            <motion.button
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                whileHover={{ scale: 1.1 }}
                                                onClick={(e) => { e.stopPropagation(); onDeviceHistory(device.mac_address); }}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                aria-label={`Bandwidth History for ${device.hostname || device.mac_address}`}
                                                title="Bandwidth History"
                                            >
                                                <BarChart3 className="w-4 h-4" />
                                            </motion.button>
                                        )}
                                        {!device.is_online && (
                                            <motion.button
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                whileHover={{ scale: 1.1 }}
                                                onClick={(e) => wakeDevice(e, device.mac_address)}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                                aria-label={`Wake ${device.hostname || device.mac_address}`}
                                                title="Wake on LAN"
                                            >
                                                <Power className="w-4 h-4" />
                                            </motion.button>
                                        )}
                                    </div>

                                    <div className="flex items-start justify-between mb-8">
                                        <div className="w-16 h-16 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm">
                                            <Icon className="w-8 h-8" />
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border transition-all duration-700",
                                            device.is_online
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                                : 'bg-secondary text-muted-foreground border-border'
                                        )}>
                                            {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-black text-foreground text-2xl truncate group-hover:text-primary transition-all duration-300 mb-1.5 tracking-tighter">{device.hostname || 'Unknown Device'}</h3>
                                        <div className="flex items-center gap-3 mb-8">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{device.vendor || 'Generic'}</span>
                                            {device.group_id && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-border" />
                                                    <span
                                                        className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-secondary border border-border"
                                                        style={{ color: groups.find((g: DeviceGroup) => g.id === device.group_id)?.color || 'hsl(var(--primary))' }}
                                                    >
                                                        {groups.find((g: DeviceGroup) => g.id === device.group_id)?.name}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/40 border border-border group-hover:border-border/80 hover:bg-secondary/60 transition-all duration-300">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Address</span>
                                                </div>
                                                <code className="text-xs font-mono text-primary/90 font-bold tabular-nums">{device.ip_address || '---'}</code>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-2xl bg-secondary/40 border border-border group-hover:border-border/80 hover:bg-secondary/60 transition-all duration-300">
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Download</div>
                                                    <div className="text-sm font-mono text-emerald-500 font-black flex items-center gap-2 tabular-nums">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        {device.download || '0 KB/s'}
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-secondary/40 border border-border group-hover:border-border/80 hover:bg-secondary/60 transition-all duration-300">
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Upload</div>
                                                    <div className="text-sm font-mono text-primary font-black flex items-center gap-2 tabular-nums">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                                                        {device.upload || '0 KB/s'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom aesthetic elements */}
                                    <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-primary/5 blur-[80px] group-hover:bg-primary/10 transition-all duration-1000 pointer-events-none" />
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
                                </PremiumCard>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )
            }

            <DeviceDetail
                device={selectedDevice}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                onUpdate={(updatedDevice) => {
                    // queryClient.invalidateQueries would be better here, but for now we'll rely on periodic refetch
                    setSelectedDevice(updatedDevice);
                }}
                groups={groups}
            />

            <GroupManager
                isOpen={isGroupManagerOpen}
                onClose={() => setIsGroupManagerOpen(false)}
                groups={groups}
            />
        </div>
    );
}
