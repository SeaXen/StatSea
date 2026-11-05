import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, Smartphone, Globe, Router, Laptop, Wifi, MoreVertical,
    LayoutGrid, LayoutList, Power, Layers, Activity, Zap, BarChart3, SortDesc,
    Cast, Server, HelpCircle, Download, FileJson, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useDevices, useDeviceGroups, useWakeDevice } from '../hooks/useDevices';
import axiosInstance from '../config/axiosInstance';
import { DeviceDetail } from './DeviceDetail';
import { Device, DeviceGroup } from '../types';
import { Skeleton, TableRowSkeleton } from './skeletons/WidgetSkeleton';
import { GroupManager } from './GroupManager';
import { CustomSelect } from './ui/CustomSelect';
import { cn } from '../lib/utils';

interface DevicesPageProps {
    onDeviceHistory?: (mac: string) => void;
}

export function DevicesPage({ onDeviceHistory }: DevicesPageProps = {}) {
    const queryClient = useQueryClient();
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
    const [isScanning, setIsScanning] = useState(false);

    const PAGE_SIZE = 25;
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, filterStatus, filterGroupId, sortBy]);

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

    const handleScan = async () => {
        setIsScanning(true);
        toast.loading('Scanning local subnet for active endpoints…', { id: 'scan-devices' });
        try {
            await queryClient.invalidateQueries({ queryKey: ['devices'] });
            toast.success('Subnet scan complete. Device list refreshed.', { id: 'scan-devices' });
        } catch {
            toast.error('Failed to scan subnet', { id: 'scan-devices' });
        } finally {
            setIsScanning(false);
        }
    };

    const handleAddDevicePrompt = () => {
        toast.info('Automatic Subnet Discovery Active', {
            description: 'New devices are automatically discovered via ARP / packet sniffing when they join the network.'
        });
    };

    const filteredDevices = useMemo(() => {
        return devices.filter((device: Device) => {
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
    }, [devices, searchQuery, filterStatus, filterGroupId, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredDevices.length / PAGE_SIZE));
    const paginatedDevices = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredDevices.slice(start, start + PAGE_SIZE);
    }, [filteredDevices, page]);

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
                <div className="bg-panel rounded-xl border border-line overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <TableRowSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="panel p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Device Fleet</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                {filteredDevices.filter((d: Device) => d.is_online).length} ONLINE
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">
                            {filteredDevices.length} managed endpoints on subnet
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-panel p-0.5 rounded-[7px] border border-line-strong">
                        <button
                            onClick={() => handleExport('devices', 'csv')}
                            disabled={isExporting}
                            className="px-2.5 py-1 hover:bg-raised rounded-[5px] text-xs font-mono text-text-soft hover:text-text transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Download className="w-3 h-3 text-accent" />
                            CSV
                        </button>
                        <div className="w-[1px] bg-line my-1" />
                        <button
                            onClick={() => handleExport('devices', 'json')}
                            disabled={isExporting}
                            className="px-2.5 py-1 hover:bg-raised rounded-[5px] text-xs font-mono text-text-soft hover:text-text transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <FileJson className="w-3 h-3 text-upload" />
                            JSON
                        </button>
                    </div>

                    <button
                        onClick={handleScan}
                        disabled={isScanning}
                        className="px-3 py-1.5 bg-raised hover:bg-line-strong rounded-[7px] text-xs font-mono text-text transition-colors border border-line flex items-center gap-2 disabled:opacity-50"
                        title="Scan local network for endpoints"
                    >
                        <Zap className={cn("w-3.5 h-3.5 text-warn", isScanning && "animate-spin")} />
                        <span>{isScanning ? 'SCANNING…' : 'SCAN'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsGroupManagerOpen(true)}
                        className="px-3 py-1.5 bg-raised hover:bg-line-strong rounded-[7px] text-xs font-mono text-text transition-colors border border-line flex items-center gap-2"
                    >
                        <Layers className="w-3.5 h-3.5 text-accent" />
                        <span>GROUPS</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAddDevicePrompt}
                        className="px-3.5 py-1.5 bg-accent hover:opacity-90 text-accent-foreground rounded-[7px] text-xs font-semibold font-mono transition-opacity shadow-sm"
                    >
                        + ADD DEVICE
                    </button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="panel p-3 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-faint" />
                    </div>
                    <input
                        type="text"
                        placeholder="Filter by name, IP, MAC address or vendor…"
                        aria-label="Filter devices by name, IP, MAC address or vendor"
                        className="w-full bg-raised border border-line rounded-[7px] pl-9 pr-3 py-1.5 text-xs font-mono text-text placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <CustomSelect
                        label="Filter"
                        options={[
                            { value: 'all', label: 'All Status' },
                            { value: 'online', label: 'Online' },
                            { value: 'offline', label: 'Offline' }
                        ]}
                        value={filterStatus}
                        onChange={(val) => setFilterStatus(val as 'all' | 'online' | 'offline')}
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

                    <div className="h-6 w-[1px] bg-line hidden md:block" />

                    <button
                        type="button"
                        onClick={() => setSortBy(sortBy === 'status' ? 'bandwidth' : 'status')}
                        className="px-2.5 py-1.5 rounded-[7px] bg-raised hover:bg-line-strong border border-line text-xs font-mono text-text-soft hover:text-text transition-colors flex items-center gap-1.5"
                        aria-label={`Sort by ${sortBy === 'status' ? 'Bandwidth' : 'Status'}`}
                        title={`Sort by ${sortBy === 'status' ? 'Bandwidth' : 'Status'}`}
                    >
                        <SortDesc className={cn("w-3.5 h-3.5", sortBy === 'bandwidth' ? "text-accent" : "text-text-soft")} />
                        <span className="hidden sm:inline">{sortBy === 'bandwidth' ? 'BW' : 'STATUS'}</span>
                    </button>

                    <div className="flex bg-raised rounded-[7px] p-0.5 border border-line">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            className={cn(
                                "px-2.5 py-1 rounded-[5px] transition-colors text-xs font-mono flex items-center gap-1.5",
                                viewMode === 'list'
                                    ? "bg-accent/15 text-accent border border-accent/20 font-medium"
                                    : "text-text-soft hover:text-text"
                            )}
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">LIST</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid view"
                            className={cn(
                                "px-2.5 py-1 rounded-[5px] transition-colors text-xs font-mono flex items-center gap-1.5",
                                viewMode === 'grid'
                                    ? "bg-accent/15 text-accent border border-accent/20 font-medium"
                                    : "text-text-soft hover:text-text"
                            )}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">GRID</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Device List */}
            {viewMode === 'list' ? (
                <div className="panel p-0 overflow-hidden">
                    <div className="table-wrap">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-line bg-raised/50 text-faint uppercase font-mono text-[10px] tracking-wider">
                                    <th className="px-4 py-2.5 font-medium">Device Identity</th>
                                    <th className="px-4 py-2.5 font-medium">Network Interface</th>
                                    <th className="px-4 py-2.5 font-medium text-center">Status</th>
                                    <th className="px-4 py-2.5 font-medium text-right">Bandwidth</th>
                                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                <AnimatePresence mode='popLayout'>
                                    {paginatedDevices.map((device: Device) => {
                                        const Icon = getIcon(device.type, device.icon_type);
                                        return (
                                            <tr
                                                key={device.id || device.mac_address}
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`View details for ${device.hostname || device.mac_address}`}
                                                onClick={() => openDetail(device)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        openDetail(device);
                                                    }
                                                }}
                                                className="hover:bg-raised/60 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent">
                                                            <Icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-text text-xs hover:text-accent transition-colors">
                                                                {device.hostname || 'Unknown Device'}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-faint uppercase">
                                                                {device.vendor || 'Unknown Vendor'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-mono">
                                                    <div className="text-text text-xs">{device.ip_address || '---'}</div>
                                                    <div className="text-faint text-[10px]">{device.mac_address}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "status text-[10px] uppercase font-mono px-2 py-0.5",
                                                        device.is_online ? "ok" : "offline"
                                                    )}>
                                                        {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono num">
                                                    <div className="text-ok text-xs">↓ {device.download || '0 B/s'}</div>
                                                    <div className="text-upload text-[10px]">↑ {device.upload || '0 B/s'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {onDeviceHistory && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); onDeviceHistory(device.mac_address); }}
                                                                className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-accent transition-colors"
                                                                aria-label={`Bandwidth history for ${device.hostname || device.mac_address}`}
                                                                title="Bandwidth History"
                                                            >
                                                                <BarChart3 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {!device.is_online && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => wakeDevice(e, device.mac_address)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-ok transition-colors"
                                                                aria-label={`Wake ${device.hostname || device.mac_address}`}
                                                                title="Wake on LAN"
                                                            >
                                                                <Power className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button 
                                                            type="button"
                                                            className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text transition-colors"
                                                            aria-label={`More options for ${device.hostname || device.mac_address}`}
                                                        >
                                                            <MoreVertical className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                    {filteredDevices.length === 0 && (
                        <div className="p-8 text-center text-text-soft font-mono text-xs">
                            No devices found matching query.
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <AnimatePresence mode='popLayout'>
                        {paginatedDevices.map((device: Device) => {
                            const Icon = getIcon(device.type, device.icon_type);
                            return (
                                <div
                                    key={device.id || device.mac_address}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`View details for ${device.hostname || device.mac_address}`}
                                    className="panel p-3 cursor-pointer hover:border-line-strong transition-colors flex flex-col justify-between focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                    onClick={() => openDetail(device)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openDetail(device);
                                        }
                                    }}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                             <div className="flex items-center gap-2">
                                                 <div className="w-7 h-7 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent">
                                                     <Icon className="w-3.5 h-3.5" />
                                                 </div>
                                                 <div>
                                                     <div className="font-medium text-text text-xs hover:text-accent transition-colors truncate max-w-[140px]">
                                                         {device.hostname || 'Unknown Device'}
                                                     </div>
                                                     <div className="text-[10px] font-mono text-faint uppercase">
                                                         {device.vendor || 'Generic'}
                                                     </div>
                                                 </div>
                                             </div>
                                             <span className={cn(
                                                 "status text-[9px] uppercase font-mono px-1.5 py-0.5",
                                                 device.is_online ? "ok" : "danger"
                                             )}>
                                                 {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                             </span>
                                         </div>

                                         <div className="bg-raised rounded-[5px] border border-line p-2 space-y-1 my-2 font-mono text-[11px]">
                                             <div className="flex justify-between items-center text-text-soft">
                                                 <span>IP</span>
                                                 <span className="text-text">{device.ip_address || '---'}</span>
                                             </div>
                                             <div className="flex justify-between items-center text-text-soft">
                                                 <span>MAC</span>
                                                 <span className="text-faint text-[10px]">{device.mac_address}</span>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="flex items-center justify-between pt-2 border-t border-line font-mono text-[11px]">
                                         <div className="flex gap-3 num">
                                             <span className="text-ok">↓ {device.download || '0 B/s'}</span>
                                             <span className="text-upload">↑ {device.upload || '0 B/s'}</span>
                                         </div>
                                         <div className="flex gap-1">
                                             {onDeviceHistory && (
                                                 <button
                                                     type="button"
                                                     onClick={(e) => { e.stopPropagation(); onDeviceHistory(device.mac_address); }}
                                                     className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-raised hover:bg-line-strong text-accent"
                                                     aria-label={`Bandwidth history for ${device.hostname || device.mac_address}`}
                                                     title="History"
                                                 >
                                                     <BarChart3 className="w-3 h-3" />
                                                 </button>
                                             )}
                                             {!device.is_online && (
                                                 <button
                                                     type="button"
                                                     onClick={(e) => wakeDevice(e, device.mac_address)}
                                                     className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-raised hover:bg-line-strong text-ok"
                                                     aria-label={`Wake ${device.hostname || device.mac_address}`}
                                                     title="WoL"
                                                 >
                                                     <Power className="w-3 h-3" />
                                                 </button>
                                             )}
                                         </div>
                                     </div>
                                </div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="panel p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                    <span className="text-text-soft">
                        Showing <span className="text-text font-semibold">{((page - 1) * PAGE_SIZE) + 1}</span>–<span className="text-text font-semibold">{Math.min(page * PAGE_SIZE, filteredDevices.length)}</span> of <span className="text-text font-semibold">{filteredDevices.length}</span> endpoints
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            aria-label="Previous page"
                            className="px-2.5 py-1 rounded-[5px] bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <span className="px-2 py-1 text-faint">
                            Page <span className="text-text font-medium">{page}</span> of <span className="text-text font-medium">{totalPages}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            aria-label="Next page"
                            className="px-2.5 py-1 rounded-[5px] bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

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
