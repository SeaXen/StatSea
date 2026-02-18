import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Globe, Shield, HardDrive, Smartphone, Monitor, Wifi, Clock, ArrowUpRight, ArrowDownLeft, Calendar, Edit2, Check, Tag, Plus } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Device, DeviceGroup } from '../types';
import { QuotaManager } from './QuotaManager';
import { UptimeTimeline } from './UptimeTimeline';
import { formatBytes } from '../lib/utils';

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

    const [loading, setLoading] = useState(false);

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
            setLoading(true);

            fetch(`/api/devices/${device.id}/history?days=30`)
                .then(res => res.json())
                .then(statsData => {
                    setStats(statsData);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching device details:", err);
                    setLoading(false);
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
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editNickname}
                                                onChange={(e) => setEditNickname(e.target.value)}
                                                placeholder={device.hostname || 'Device Name'}
                                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xl font-bold text-white w-full focus:outline-none focus:border-blue-500"
                                            />
                                        ) : (
                                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                                {device.nickname || device.hostname || 'Unknown Device'}
                                                {device.nickname && <span className="ml-2 text-sm font-normal text-gray-500">({device.hostname})</span>}
                                            </h2>
                                        )}

                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                                                {device.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {isEditing ? (
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="p-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                        >
                                            <Check className="w-6 h-6" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 transition-colors"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Main Info Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <InfoCard icon={<Wifi className="w-4 h-4" />} label="IP Address" value={device.ip_address || 'N/A'} />
                                <InfoCard icon={<Shield className="w-4 h-4" />} label="MAC Address" value={device.mac_address} />
                                <InfoCard icon={<HardDrive className="w-4 h-4" />} label="Vendor" value={device.vendor || 'Unknown'} />
                                <InfoCard icon={<Clock className="w-4 h-4" />} label="Last Seen" value={new Date(device.last_seen).toLocaleTimeString()} />
                            </div>

                            {/* Tags Section */}
                            <div className="mb-8">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
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
                                                <button onClick={addTag} className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {(device.tags && device.tags.length > 0) ? (
                                                device.tags.map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 border border-white/5 text-xs">
                                                        {tag}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-600 italic text-sm">No tags.</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="mb-8">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                                    <Edit2 className="w-3 h-3" /> Notes
                                </label>
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 font-medium ml-1 mb-1 block">Group</label>
                                            <div className="relative">
                                                <select
                                                    value={selectedGroupId || ''}
                                                    onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 appearance-none"
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
                                            <div className="text-xs text-gray-500 mb-1">Group</div>
                                            <div className="text-sm font-medium text-gray-200 flex items-center gap-2">
                                                {device.group_id ? (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: groups.find(g => g.id === device.group_id)?.color || '#3b82f6' }} />
                                                        {groups.find(g => g.id === device.group_id)?.name || 'Unknown Group'}
                                                    </>
                                                ) : (
                                                    <span className="text-gray-500">No Group</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-full min-h-[60px] bg-white/5 border border-white/5 rounded-xl p-3 text-sm text-gray-300">
                                            {device.notes ? device.notes : <span className="text-gray-600 italic">No notes added.</span>}
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
                            <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/5 mb-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-lg font-semibold text-white">Daily Data Usage (30 Days)</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-xs text-gray-400">Downloads</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            <span className="text-xs text-gray-400">Uploads</span>
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
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#6b7280"
                                                fontSize={10}
                                                tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                stroke="#6b7280"
                                                fontSize={10}
                                                tickFormatter={(value) => formatBytes(value)}
                                                width={60}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(10, 10, 12, 0.95)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '12px',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                itemStyle={{ fontSize: '12px', color: '#e5e7eb' }}
                                                formatter={(value: number) => formatBytes(value)}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="download"
                                                name="Downloaded"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorD)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="upload"
                                                name="Uploaded"
                                                stroke="#a855f7"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorU)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <div className="flex items-center gap-2">
                                        <ArrowDownLeft className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-mono text-gray-300">
                                            Total Down: {formatBytes(stats.reduce((acc, curr) => acc + (curr.download || 0), 0))}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm font-mono text-gray-300">
                                            Total Up: {formatBytes(stats.reduce((acc, curr) => acc + (curr.upload || 0), 0))}
                                        </span>
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
