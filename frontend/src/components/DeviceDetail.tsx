import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Globe, Shield, HardDrive, Smartphone, Monitor, Clock, Calendar, Edit2, Check, Tag, Plus, Router, Cast, Server, HelpCircle, Laptop, Power } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Device, DeviceGroup } from '../types';
import { QuotaManager } from './QuotaManager';
import { UptimeTimeline } from './UptimeTimeline';
import { formatBytes, cn } from '../lib/utils';
import { useWakeDevice } from '../hooks/useDevices';
import { useModalA11y } from '../hooks/useModalA11y';
import axiosInstance from '../config/axiosInstance';

interface DailyUsage {
    date: string;
    upload: number;
    download: number;
}

interface DeviceDetailProps {
    device: Device | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: (updatedDevice: Device) => void;
    groups: DeviceGroup[];
}

export function DeviceDetail({ device, isOpen, onClose, onUpdate, groups }: DeviceDetailProps) {
    const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
    const [stats, setStats] = useState<DailyUsage[]>([]);
    const { mutate: wakeDevice, isPending: isWaking } = useWakeDevice();


    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editNickname, setEditNickname] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editTags, setEditTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (device) {
            setEditNickname(device.nickname || '');
            setEditNotes(device.notes || '');
            setEditTags(device.tags || []);
            setSelectedGroupId(device.group_id || null);
            setIsEditing(false);
            setNewTag('');
        }
    }, [device, isOpen]);

    const handleSave = async () => {
        if (!device) return;
        setSaving(true);
        try {
            const response = await axiosInstance.put(`/devices/${device.id}`, {
                nickname: editNickname || null,
                notes: editNotes || null,
                tags: editTags,
                group_id: selectedGroupId
            });

            if (onUpdate) onUpdate(response.data);
            setIsEditing(false);
        } catch (err) {
            console.error("Error updating device:", err);
        } finally {
            setSaving(false);
        }
    };

    const addTag = () => {
        if (newTag.trim() && !editTags.includes(newTag.trim())) {
            setEditTags([...editTags, newTag.trim()]);
            setNewTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setEditTags(editTags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    useEffect(() => {
        if (device && isOpen) {
            axiosInstance.get(`/devices/${device.id}/history?days=30`)
                .then(res => {
                    setStats(res.data);
                })
                .catch(err => {
                    console.error("Error fetching device details:", err);
                });
        }
    }, [device, isOpen]);

    if (!device) return null;

    // Calculate usage for QuotaManager
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyUsage = stats.find(s => s.date.startsWith(todayStr))
        ? (stats.find(s => s.date.startsWith(todayStr))!.upload + stats.find(s => s.date.startsWith(todayStr))!.download)
        : 0;

    const monthlyUsage = stats.reduce((acc, curr) => acc + curr.upload + curr.download, 0);

    const getIcon = (type?: string, iconType?: string) => {
        if (iconType) {
            switch (iconType) {
                case 'smartphone': return <Smartphone className="w-6 h-6" />;
                case 'router': return <Router className="w-6 h-6" />;
                case 'cast': return <Cast className="w-6 h-6" />;
                case 'computer': return <Laptop className="w-6 h-6" />;
                case 'server': return <Server className="w-6 h-6" />;
                case 'help': return <HelpCircle className="w-6 h-6" />;
            }
        }
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
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Device Details"
                        tabIndex={-1}
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{
                            type: 'spring',
                            damping: 32,
                            stiffness: 280,
                            mass: 0.8
                        }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-panel/95 backdrop-blur-3xl border-l border-line z-50 shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {/* Decorative background glow */}
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/5 blur-[100px] pointer-events-none" />

                            <div className="p-8 md:p-10 relative">
                                {/* Top bar */}
                                <div className="flex justify-between items-center mb-8">
                                    <div role="tablist" aria-label="Device view options" className="flex bg-raised p-1 rounded-[7px] border border-line">
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={!isEditing}
                                            onClick={() => setIsEditing(false)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-[5px] text-[10px] font-bold tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                !isEditing ? "bg-panel text-text shadow-sm" : "text-faint hover:text-text"
                                            )}
                                        >
                                            OVERVIEW
                                        </button>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={isEditing}
                                            onClick={() => setIsEditing(true)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-[5px] text-[10px] font-bold tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                isEditing ? "bg-panel text-text shadow-sm" : "text-faint hover:text-text"
                                            )}
                                        >
                                            EDIT
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close device details"
                                        className="w-9 h-9 flex items-center justify-center rounded-[7px] bg-raised hover:bg-raised/80 text-faint hover:text-text transition-colors border border-line group"
                                    >
                                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </div>

                                {/* Header Section */}
                                <div className="mb-8">
                                    <div className="flex items-start gap-5">
                                        <div className="w-16 h-16 rounded-[var(--r-panel)] bg-accent/10 text-accent flex items-center justify-center border border-accent/20 shadow-sm shrink-0">
                                            {getIcon(device.type, device.icon_type)}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            {isEditing ? (
                                                <div className="space-y-4">
                                                    <input
                                                        type="text"
                                                        value={editNickname}
                                                        onChange={(e) => setEditNickname(e.target.value)}
                                                        placeholder={device.hostname || 'e.g. Core Switch…'}
                                                        aria-label="Device nickname"
                                                        className="w-full bg-raised border border-line rounded-[7px] px-4 py-2.5 text-xl font-bold text-text focus:outline-none focus:border-line-strong focus-visible:ring-1 focus-visible:ring-accent transition-colors placeholder:text-faint"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <h2 className="text-2xl font-bold text-text tracking-tight truncate leading-tight">
                                                        {device.nickname || device.hostname || 'Unknown Device'}
                                                    </h2>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[9px] font-bold uppercase tracking-widest border transition-colors",
                                                            device.is_online
                                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                                : 'bg-raised text-faint border-line'
                                                        )}>
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-faint/50'
                                                            )} />
                                                            {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                                        </div>
                                                        <span className="text-faint text-[10px] font-bold uppercase tracking-widest leading-none">•</span>
                                                        <div className="text-[10px] font-mono text-faint uppercase tracking-wider pt-0.5">
                                                            {device.hostname}
                                                        </div>
                                                        {!device.is_online && (
                                                            <>
                                                                <span className="text-faint text-[10px] font-bold uppercase tracking-widest leading-none">•</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => wakeDevice(device.mac_address)}
                                                                    disabled={isWaking}
                                                                    aria-label="Wake device"
                                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                                                >
                                                                    {isWaking ? <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> : <Power className="w-3 h-3" />}
                                                                    WAKE
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                disabled={saving}
                                                aria-label="Save changes"
                                                className="w-10 h-10 flex items-center justify-center rounded-[7px] bg-accent hover:opacity-90 text-black font-bold transition-opacity shadow-md disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                            >
                                                {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Main Info Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-8">
                                    <InfoCard
                                        icon={<Globe className="w-4 h-4 text-accent" />}
                                        label="NETWORK IP"
                                        value={device.ip_address || '---'}
                                        subValue="Internal Gateway"
                                    />
                                    <InfoCard
                                        icon={<Shield className="w-4 h-4 text-cyan-400" />}
                                        label="HARDWARE ID"
                                        value={device.mac_address}
                                        subValue="Unique Signal"
                                    />
                                    <InfoCard
                                        icon={<HardDrive className="w-4 h-4 text-emerald-400" />}
                                        label="MANUFACTURER"
                                        value={device.vendor || 'Unknown'}
                                        subValue="System Vendor"
                                    />
                                    <InfoCard
                                        icon={<Clock className="w-4 h-4 text-yellow-400" />}
                                        label="LAST ACTIVE"
                                        value={new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        subValue={new Date(device.last_seen).toLocaleDateString()}
                                    />
                                </div>

                                {/* Tags Section */}
                                <div className="mb-6">
                                    <label className="flex items-center gap-2 text-xs font-bold text-faint uppercase tracking-wider mb-2">
                                        <Tag className="w-3 h-3 text-accent" /> Tags
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {isEditing ? (
                                            <>
                                                {editTags.map(tag => (
                                                    <span key={tag} className="px-2 py-1 rounded-[5px] bg-accent/10 text-accent border border-accent/20 text-xs flex items-center gap-1 font-mono">
                                                        {tag}
                                                        <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                                                    </span>
                                                ))}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={newTag}
                                                        onChange={(e) => setNewTag(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        placeholder="Add tag…"
                                                        aria-label="New tag name"
                                                        className="bg-raised border border-line rounded-[5px] px-2 py-1 text-xs text-text focus:outline-none focus:border-line-strong focus-visible:ring-1 focus-visible:ring-accent min-w-[80px]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={addTag}
                                                        aria-label="Add tag"
                                                        className="p-1 rounded-[5px] bg-raised hover:border-line-strong text-faint hover:text-text border border-line transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {(device.tags && device.tags.length > 0) ? (
                                                    device.tags.map(tag => (
                                                        <span key={tag} className="px-2.5 py-1 rounded-[5px] bg-raised text-text border border-line text-xs font-mono">
                                                            {tag}
                                                        </span>
                                                    ))
                                                 ) : (
                                                     <span className="text-faint italic text-xs">No tags.</span>
                                                 )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Notes Section */}
                                <div className="mb-6">
                                    <label className="flex items-center gap-2 text-xs font-bold text-faint uppercase tracking-wider mb-2">
                                        <Edit2 className="w-3 h-3 text-accent" /> Notes
                                    </label>
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-faint font-medium mb-1 block">Group</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedGroupId || ''}
                                                        aria-label="Device group"
                                                        onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                                                        className="w-full bg-raised border border-line rounded-[7px] px-3 py-2 text-sm text-text focus:outline-none focus:border-line-strong focus-visible:ring-1 focus-visible:ring-accent appearance-none"
                                                    >
                                                        <option value="" className="bg-panel text-text">No Group</option>
                                                        {groups.map(g => (
                                                            <option key={g.id} value={g.id} className="bg-panel text-text">{g.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                className="w-full h-24 bg-raised border border-line rounded-[7px] p-3 text-sm text-text focus:outline-none focus:border-line-strong focus-visible:ring-1 focus-visible:ring-accent resize-none"
                                                placeholder="Add notes about this device…"
                                                aria-label="Device notes"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-3">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-faint mb-1">Group</div>
                                                <div className="text-sm font-medium text-text flex items-center gap-2">
                                                    {device.group_id ? (
                                                        <>
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: groups.find(g => g.id === device.group_id)?.color || '#3b82f6' }} />
                                                            {groups.find(g => g.id === device.group_id)?.name || 'Unknown Group'}
                                                        </>
                                                    ) : (
                                                        <span className="text-faint text-xs">No Group</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full min-h-[50px] bg-raised border border-line rounded-[7px] p-3 text-sm text-text">
                                                {device.notes ? device.notes : <span className="text-faint italic text-xs">No notes added.</span>}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Quota Manager */}
                                <QuotaManager
                                    deviceId={device.id}
                                    dailyUsage={dailyUsage}
                                    monthlyUsage={monthlyUsage}
                                />

                                {/* Uptime Timeline */}
                                <div className="panel rounded-[var(--r-panel)] p-5 md:p-6 border border-line bg-panel mb-8">
                                    <UptimeTimeline deviceId={device.id} />
                                </div>

                                {/* Traffic Insights */}
                                <div className="panel rounded-[var(--r-panel)] p-6 md:p-8 border border-line mb-8 overflow-hidden relative bg-panel">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none group-hover/chart:bg-accent/10 transition-colors duration-1000" />

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-[7px] bg-accent/10 flex items-center justify-center border border-accent/20">
                                                <Calendar className="w-5 h-5 text-accent" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-text tracking-tight">Traffic Activity</h3>
                                                <p className="text-[10px] font-bold text-faint uppercase tracking-[0.2em]">30 DAY ANALYTICS ENGINE</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[10px] font-bold text-faint uppercase tracking-widest">DOWNLOADS</span>
                                                </div>
                                                <span className="text-text font-mono font-bold text-sm tabular-nums">↓ {formatBytes(stats.reduce((acc, curr) => acc + (curr.download || 0), 0))}</span>
                                            </div>
                                            <div className="w-[1px] h-8 bg-line" />
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(0,229,153,0.5)]" />
                                                    <span className="text-[10px] font-bold text-faint uppercase tracking-widest">UPLOADS</span>
                                                </div>
                                                <span className="text-text font-mono font-bold text-sm tabular-nums">↑ {formatBytes(stats.reduce((acc, curr) => acc + (curr.upload || 0), 0))}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-[280px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorD" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorU" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="0" stroke="var(--line)" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="var(--faint)"
                                                    fontSize={9}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { day: '2-digit' })}
                                                />
                                                <YAxis
                                                    stroke="var(--faint)"
                                                    fontSize={9}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => formatBytes(value).split(' ')[0]}
                                                />
                                                <Tooltip
                                                    cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-panel/95 backdrop-blur-xl border border-line p-3 rounded-[7px] shadow-2xl text-text font-mono">
                                                                    <p className="text-[10px] font-bold text-faint uppercase tracking-[0.2em] mb-3">
                                                                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between gap-8">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                <span className="text-[10px] font-bold text-faint uppercase tracking-widest">Down</span>
                                                                            </div>
                                                                            <span className="text-xs font-mono font-bold text-emerald-500 tabular-nums">{formatBytes(payload[0].value as number)}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-8">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                                                                <span className="text-[10px] font-bold text-faint uppercase tracking-widest">Up</span>
                                                                            </div>
                                                                            <span className="text-xs font-mono font-bold text-accent tabular-nums">{formatBytes(payload[1].value as number)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="download"
                                                    stroke="#10b981"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorD)"
                                                    animationDuration={1500}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="upload"
                                                    stroke="#06b6d4"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorU)"
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {device.ports && device.ports.length > 0 && (
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-[7px] bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                                <Shield className="w-4 h-4 text-orange-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-text tracking-tight">Open Ports</h3>
                                                <p className="text-[10px] font-bold text-faint uppercase tracking-[0.2em]">EXTERNAL SERVICE MAP</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {device.ports.map((port) => (
                                                <div key={port.id} className="flex items-center justify-between p-3 rounded-[7px] bg-raised border border-line group/port hover:border-line-strong transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-base font-bold text-text w-12 tabular-nums">{port.port}</div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{port.service || 'UNKNOWN'}</span>
                                                            <span className="text-[9px] font-medium text-faint uppercase tracking-widest">{port.protocol} • {port.state}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] font-mono text-faint uppercase tracking-widest tabular-nums">
                                                        LAST SEEN: {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(port.last_discovered))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Security & Analysis Footer */}
                                <div className="grid grid-cols-2 gap-4 pb-16">
                                    <div className="p-5 rounded-[var(--r-panel)] bg-red-500/5 border border-red-500/20 group/sec hover:bg-red-500/10 transition-colors duration-300">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-[7px] bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover/sec:scale-105 transition-transform">
                                                <Shield className="w-4 h-4 text-red-400" />
                                            </div>
                                            <h4 className="text-xs font-bold text-text uppercase tracking-widest">Security</h4>
                                        </div>
                                        <div className="space-y-2">
                                            <SecurityItem label="Firewall" status="SHIELDED" />
                                            <SecurityItem label="Encrypted" status="ACTIVE" />
                                            <SecurityItem label="Risk Score" status="0.01" />
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-[var(--r-panel)] bg-raised border border-line group/sys hover:border-line-strong transition-colors duration-300">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-[7px] bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover/sys:scale-105 transition-transform">
                                                <Cpu className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <h4 className="text-xs font-bold text-text uppercase tracking-widest">System</h4>
                                        </div>
                                        <div className="space-y-3 pt-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-faint uppercase tracking-[0.2em]">
                                                <span>OS</span>
                                                <span className="text-text font-bold">Unknown</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold text-faint uppercase tracking-[0.2em]">
                                                <span>Uptime</span>
                                                <span className="text-text font-bold tabular-nums">99.9%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function InfoCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue?: string }) {
    return (
        <div className="p-4 md:p-5 rounded-[var(--r-panel)] bg-raised border border-line group/info hover:border-line-strong transition-colors duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/info:opacity-20 transition-opacity">
                {icon}
            </div>
            <div className="relative">
                <div className="text-[9px] font-bold text-faint uppercase tracking-[0.2em] mb-2">{label}</div>
                <div className="text-base font-bold text-text truncate mb-1 tracking-tight">{value}</div>
                {subValue && <div className="text-[9px] font-medium text-faint uppercase tracking-widest">{subValue}</div>}
            </div>
        </div>
    );
}

function SecurityItem({ label, status }: { label: string, status: string }) {
    return (
        <div className="flex items-center justify-between p-2.5 rounded-[7px] bg-raised border border-line">
            <span className="text-[10px] font-bold text-faint uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{status}</span>
        </div>
    );
}
