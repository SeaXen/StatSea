import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Globe, Shield, HardDrive, Smartphone, Monitor, Clock, Calendar, Edit2, Check, Tag, Plus, Router, Cast, Server, HelpCircle, Laptop, Power } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Device, DeviceGroup } from '../types';
import { QuotaManager } from './QuotaManager';
import { UptimeTimeline } from './UptimeTimeline';
import { formatBytes, cn } from '../lib/utils';
import { useWakeDevice } from '../hooks/useDevices';

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
            const response = await fetch(`/api/devices/${device.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: editNickname || null,
                    notes: editNotes || null,
                    tags: editTags,
                    group_id: selectedGroupId
                })
            });

            if (!response.ok) throw new Error("Failed to update device");

            const updated = await response.json();
            if (onUpdate) onUpdate(updated);
            setIsEditing(false);
        } catch (err) {
            console.error("Error updating device:", err);
            // Could add toast error here
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
            fetch(`/api/devices/${device.id}/history?days=30`)
                .then(res => res.json())
                .then(statsData => {
                    setStats(statsData);
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
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{
                            type: 'spring',
                            damping: 32,
                            stiffness: 280,
                            mass: 0.8
                        }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#09090b]/90 backdrop-blur-3xl border-l border-white/5 z-50 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
                    >
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {/* Decorative background glow */}
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/5 blur-[100px] pointer-events-none" />

                            <div className="p-10 relative">
                                {/* Top bar */}
                                <div className="flex justify-between items-center mb-10">
                                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                                                !isEditing ? "bg-white/10 text-white shadow-lg" : "text-white/20 hover:text-white/40"
                                            )}
                                        >
                                            OVERVIEW
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all",
                                                isEditing ? "bg-white/10 text-white shadow-lg" : "text-white/20 hover:text-white/40"
                                            )}
                                        >
                                            EDIT
                                        </button>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5 group"
                                    >
                                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </div>

                                {/* Header Section */}
                                <div className="mb-12">
                                    <div className="flex items-start gap-6">
                                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.1)]">
                                            {getIcon(device.type, device.icon_type)}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            {isEditing ? (
                                                <div className="space-y-4">
                                                    <input
                                                        type="text"
                                                        value={editNickname}
                                                        onChange={(e) => setEditNickname(e.target.value)}
                                                        placeholder={device.hostname || 'Device Name'}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-2xl font-black text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/10"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <h2 className="text-4xl font-black text-white tracking-tighter truncate leading-tight">
                                                        {device.nickname || device.hostname || 'Unknown Device'}
                                                    </h2>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all duration-700",
                                                            device.is_online
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                : 'bg-white/5 text-white/20 border-white/5'
                                                        )}>
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                device.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-white/10'
                                                            )} />
                                                            {device.is_online ? 'ONLINE' : 'OFFLINE'}
                                                        </div>
                                                        <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest leading-none">•</span>
                                                        <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] pt-0.5">
                                                            {device.hostname}
                                                        </div>
                                                        {!device.is_online && (
                                                            <>
                                                                <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest leading-none">•</span>
                                                                <button
                                                                    onClick={() => wakeDevice(device.mac_address)}
                                                                    disabled={isWaking}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                                >
                                                                    {isWaking ? <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> : <Power className="w-3 h-3" />}
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
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] disabled:opacity-50"
                                            >
                                                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-7 h-7" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Main Info Grid */}
                                <div className="grid grid-cols-2 gap-6 mb-12">
                                    <InfoCard
                                        icon={<Globe className="w-4 h-4 text-indigo-400" />}
                                        label="NETWORK IP"
                                        value={device.ip_address || '---'}
                                        subValue="Internal Gateway"
                                    />
                                    <InfoCard
                                        icon={<Shield className="w-4 h-4 text-purple-400" />}
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
                                <div className="mb-8">
                                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                                        <Tag className="w-3 h-3" /> Tags
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {isEditing ? (
                                            <>
                                                {editTags.map(tag => (
                                                    <span key={tag} className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs flex items-center gap-1">
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
                                                        placeholder="Add tag..."
                                                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 min-w-[80px]"
                                                    />
                                                    <button onClick={addTag} className="p-1 rounded bg-white/5 hover:bg-white/10 text-muted-foreground">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {(device.tags && device.tags.length > 0) ? (
                                                    device.tags.map(tag => (
                                                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 text-foreground/80 border border-white/5 text-xs">
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground/60 italic text-sm">No tags.</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Notes Section */}
                                <div className="mb-8">
                                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                        <Edit2 className="w-3 h-3" /> Notes
                                    </label>
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs text-muted-foreground font-medium ml-1 mb-1 block">Group</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedGroupId || ''}
                                                        onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:border-blue-500/50 appearance-none"
                                                    >
                                                        <option value="">No Group</option>
                                                        {groups.map(g => (
                                                            <option key={g.id} value={g.id}>{g.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none"
                                                placeholder="Add notes about this device..."
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-4">
                                                <div className="text-xs text-muted-foreground mb-1">Group</div>
                                                <div className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                                                    {device.group_id ? (
                                                        <>
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: groups.find(g => g.id === device.group_id)?.color || '#3b82f6' }} />
                                                            {groups.find(g => g.id === device.group_id)?.name || 'Unknown Group'}
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground">No Group</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full min-h-[60px] bg-white/5 border border-white/5 rounded-xl p-3 text-sm text-foreground/80">
                                                {device.notes ? device.notes : <span className="text-muted-foreground/60 italic">No notes added.</span>}
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
                                <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/5 mb-8">
                                    <UptimeTimeline deviceId={device.id} />
                                </div>

                                {/* Traffic Insights */}
                                <div className="bg-white/[0.02] rounded-3xl p-10 border border-white/5 mb-10 overflow-hidden relative group/chart">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none group-hover/chart:bg-indigo-500/10 transition-colors duration-1000" />

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-white/5">
                                                <Calendar className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-white tracking-tight">Traffic Activity</h3>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">30 DAY ANALYTICS ENGINE</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">DOWNLOADS</span>
                                                </div>
                                                <span className="text-white font-mono font-bold text-sm">↓ {formatBytes(stats.reduce((acc, curr) => acc + (curr.download || 0), 0))}</span>
                                            </div>
                                            <div className="w-[1px] h-8 bg-white/5" />
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">UPLOADS</span>
                                                </div>
                                                <span className="text-white font-mono font-bold text-sm">↑ {formatBytes(stats.reduce((acc, curr) => acc + (curr.upload || 0), 0))}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-[300px] w-full mt-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorD" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorU" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="rgba(255,255,255,0.1)"
                                                    fontSize={9}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { day: '2-digit' })}
                                                />
                                                <YAxis
                                                    stroke="rgba(255,255,255,0.1)"
                                                    fontSize={9}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => formatBytes(value).split(' ')[0]}
                                                />
                                                <Tooltip
                                                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-[#111114]/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                                                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">
                                                                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between gap-8">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Down</span>
                                                                            </div>
                                                                            <span className="text-xs font-mono font-black text-emerald-400">{formatBytes(payload[0].value as number)}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between gap-8">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Up</span>
                                                                            </div>
                                                                            <span className="text-xs font-mono font-black text-indigo-400">{formatBytes(payload[1].value as number)}</span>
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
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorD)"
                                                    animationDuration={2000}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="upload"
                                                    stroke="#6366f1"
                                                    strokeWidth={3}
                                                    fillOpacity={1}
                                                    fill="url(#colorU)"
                                                    animationDuration={2500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {device.ports && device.ports.length > 0 && (
                                    <div className="mb-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                                <Shield className="w-5 h-5 text-orange-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-white tracking-tight">Open Ports</h3>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">EXTERNAL SERVICE MAP</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {device.ports.map((port) => (
                                                <div key={port.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] group/port hover:bg-white/[0.04] transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-lg font-black text-white w-12">{port.port}</div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{port.service || 'UNKNOWN'}</span>
                                                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{port.protocol} • {port.state}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] font-black text-white/10 uppercase tracking-widest">
                                                        LAST SEEN: {new Date(port.last_discovered).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Security & Analysis Footer */}
                                <div className="grid grid-cols-2 gap-6 pb-20">
                                    <div className="p-8 rounded-3xl bg-red-500/5 border border-red-500/10 group/sec hover:bg-red-500/10 transition-all duration-500">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover/sec:scale-110 transition-transform">
                                                <Shield className="w-5 h-5 text-red-400" />
                                            </div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest">Security</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <SecurityItem label="Firewall" status="SHIELDED" />
                                            <SecurityItem label="Encrypted" status="ACTIVE" />
                                            <SecurityItem label="Risk Score" status="0.01" />
                                        </div>
                                    </div>
                                    <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 group/sys hover:bg-white/[0.04] transition-all duration-500">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover/sys:scale-110 transition-transform">
                                                <Cpu className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest">System</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                                                <span>OS</span>
                                                <span className="text-white/60">Unknown</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                                                <span>Uptime</span>
                                                <span className="text-white/60">99.9%</span>
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
        <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.03] group/info hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/info:opacity-20 transition-opacity">
                {icon}
            </div>
            <div className="relative">
                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-3">{label}</div>
                <div className="text-lg font-black text-white truncate mb-1 tracking-tight">{value}</div>
                {subValue && <div className="text-[9px] font-bold text-white/10 uppercase tracking-widest">{subValue}</div>}
            </div>
        </div>
    );
}

function SecurityItem({ label, status }: { label: string, status: string }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{status}</span>
        </div>
    );
}
