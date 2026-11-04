import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { DeviceGroup } from '../types';
import { useAddGroup, useUpdateGroup, useDeleteGroup } from '../hooks/useDevices';

interface GroupManagerProps {
    isOpen: boolean;
    onClose: () => void;
    groups: DeviceGroup[];
}

export function GroupManager({ isOpen, onClose, groups: initialGroups }: GroupManagerProps) {
    const [localGroups, setLocalGroups] = useState<DeviceGroup[]>(initialGroups);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#3b82f6');

    const addGroupMutation = useAddGroup();
    const updateGroupMutation = useUpdateGroup();
    const deleteGroupMutation = useDeleteGroup();

    useEffect(() => {
        setLocalGroups(initialGroups);
    }, [initialGroups]);

    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
        '#06b6d4', '#3b82f6', '#0ea5e9', '#14b8a6', '#0284c7',
        '#f43f5e', '#64748b'
    ];

    const handleCreate = async () => {
        if (!newGroupName.trim()) return;

        try {
            await addGroupMutation.mutateAsync({ name: newGroupName, color: newGroupColor });

            setNewGroupName('');
            setNewGroupColor('#3b82f6');
            setIsAdding(false);
            toast.success('Group created successfully');
        } catch {
            toast.error('Failed to create group');
        }
    };

    const handleUpdate = async (group: DeviceGroup) => {
        try {
            await updateGroupMutation.mutateAsync({ id: group.id, name: group.name, color: group.color });

            setEditingId(null);
            toast.success('Group updated');
        } catch {
            toast.error('Failed to update group');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? Devices in this group will be ungrouped.')) return;

        try {
            await deleteGroupMutation.mutateAsync(id);
            toast.success('Group deleted');
        } catch {
            toast.error('Failed to delete group');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="panel bg-panel border border-line rounded-[var(--r-panel)] w-full max-w-md overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-5 border-b border-line bg-raised">
                    <h2 className="text-base font-bold text-text">Manage Groups</h2>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-panel rounded-[5px] text-faint hover:text-text border border-transparent hover:border-line transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {/* Add New Group */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2.5 border border-dashed border-line rounded-[7px] text-xs font-bold uppercase tracking-wider text-faint hover:text-text hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4 text-accent" />
                            Create New Group
                        </button>
                    ) : (
                        <div className="bg-raised p-4 rounded-[7px] border border-line space-y-3">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Group Name"
                                className="w-full bg-panel border border-line rounded-[7px] px-3 py-2 text-sm text-text focus:outline-none focus:border-line-strong"
                                autoFocus
                            />
                            <div className="flex gap-2 flex-wrap">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setNewGroupColor(color)}
                                        className={`w-5 h-5 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-accent' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2 justify-end mt-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="px-3 py-1.5 text-xs text-faint hover:text-text font-bold uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="px-3 py-1.5 bg-accent hover:opacity-90 text-black text-xs font-bold rounded-[5px] flex items-center gap-1.5 uppercase tracking-wider"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Group List */}
                    <div className="space-y-2">
                        {localGroups.map(group => (
                            <div key={group.id} className="flex items-center justify-between p-3 bg-raised rounded-[7px] border border-line group hover:border-line-strong transition-colors">
                                {editingId === group.id ? (
                                    <div className="flex-1 flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={group.name}
                                            onChange={(e) => setLocalGroups(localGroups.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                                            className="flex-1 bg-panel border border-line rounded-[5px] px-2 py-1 text-sm text-text focus:outline-none focus:border-line-strong"
                                        />
                                        <div className="flex gap-1">
                                            {colors.slice(0, 5).map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setLocalGroups(localGroups.map(g => g.id === group.id ? { ...g, color } : g))}
                                                    className={`w-4 h-4 rounded-full ${group.color === color ? 'ring-1 ring-accent' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => handleUpdate(group)}
                                            className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-[5px]"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                                            <span className="font-bold text-sm text-text">{group.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingId(group.id)}
                                                className="p-1.5 hover:bg-panel text-faint hover:text-text rounded-[5px] border border-transparent hover:border-line"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(group.id)}
                                                className="p-1.5 hover:bg-red-500/20 text-faint hover:text-red-400 rounded-[5px] border border-transparent hover:border-red-500/30"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {localGroups.length === 0 && !isAdding && (
                            <div className="text-center text-faint py-8 text-xs font-mono">
                                No groups created yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
