import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { DeviceGroup } from '../types';

interface GroupManagerProps {
    isOpen: boolean;
    onClose: () => void;
    groups: DeviceGroup[];
    setGroups: (groups: DeviceGroup[]) => void;
}

export function GroupManager({ isOpen, onClose, groups, setGroups }: GroupManagerProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('#3b82f6');

    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
        '#f43f5e', '#64748b'
    ];

    const handleCreate = async () => {
        if (!newGroupName.trim()) return;

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGroupName, color: newGroupColor })
            });

            if (!response.ok) throw new Error('Failed to create group');

            const newGroup = await response.json();
            setGroups([...groups, newGroup]);
            setNewGroupName('');
            setNewGroupColor('#3b82f6');
            setIsAdding(false);
            toast.success('Group created successfully');
        } catch (error) {
            toast.error('Failed to create group');
        }
    };

    const handleUpdate = async (group: DeviceGroup) => {
        try {
            const response = await fetch(`/api/groups/${group.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: group.name, color: group.color })
            });

            if (!response.ok) throw new Error('Failed to update group');

            const updatedGroup = await response.json();
            setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
            setEditingId(null);
            toast.success('Group updated');
        } catch (error) {
            toast.error('Failed to update group');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? Devices in this group will be ungrouped.')) return;

        try {
            const response = await fetch(`/api/groups/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete group');

            setGroups(groups.filter(g => g.id !== id));
            toast.success('Group deleted');
        } catch (error) {
            toast.error('Failed to delete group');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A0B0E] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white">Manage Groups</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Add New Group */}
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Create New Group
                        </button>
                    ) : (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="Group Name"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                autoFocus
                            />
                            <div className="flex gap-2 flex-wrap">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setNewGroupColor(color)}
                                        className={`w-6 h-6 rounded-full transition-transform ${newGroupColor === color ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2 justify-end mt-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg flex items-center gap-2"
                                >
                                    <Plus className="w-3 h-3" />
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Group List */}
                    <div className="space-y-2">
                        {groups.map(group => (
                            <div key={group.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                {editingId === group.id ? (
                                    <div className="flex-1 flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={group.name}
                                            onChange={(e) => setGroups(groups.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-sm"
                                        />
                                        <div className="flex gap-1">
                                            {colors.slice(0, 5).map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setGroups(groups.map(g => g.id === group.id ? { ...g, color } : g))}
                                                    className={`w-4 h-4 rounded-full ${group.color === color ? 'ring-1 ring-white' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => handleUpdate(group)}
                                            className="p-1.5 hover:bg-green-500/20 text-green-400 rounded-lg"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                                            <span className="font-medium text-gray-200">{group.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingId(group.id)}
                                                className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(group.id)}
                                                className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {groups.length === 0 && !isAdding && (
                            <div className="text-center text-gray-500 py-8 text-sm">
                                No groups created yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
