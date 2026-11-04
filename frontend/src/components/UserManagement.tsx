import React, { useState } from 'react';
import axios from 'axios';
import {
    Users,
    UserPlus,
    Search,
    Edit2,
    Trash2,
    Shield,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useUsers';
import { PremiumCard } from './ui/PremiumCard';
import { CustomSelect } from './ui/CustomSelect';
import { cn } from '../lib/utils';

interface User {
    id: number;
    username: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    is_admin: boolean;
    last_login: string | null;
    created_at: string;
}

export const UserManagement: React.FC = () => {
    const { data: users = [], isLoading } = useUsers() as { data: User[]; isLoading: boolean };
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        full_name: '',
        password: '',
        is_admin: false,
        is_active: true
    });

    const handleOpenModal = (mode: 'add' | 'edit', user?: User) => {
        setModalMode(mode);
        if (mode === 'edit' && user) {
            setSelectedUser(user);
            setFormData({
                username: user.username,
                email: user.email,
                full_name: user.full_name || '',
                password: '', // Password remains empty unless changing
                is_admin: user.is_admin,
                is_active: user.is_active
            });
        } else {
            setSelectedUser(null);
            setFormData({
                username: '',
                email: '',
                full_name: '',
                password: '',
                is_admin: false,
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                await createUserMutation.mutateAsync(formData);
                toast.success('User created successfully');
            } else if (selectedUser) {
                const updateData: Partial<typeof formData> & { password?: string } = {
                    email: formData.email,
                    full_name: formData.full_name,
                    is_admin: formData.is_admin,
                    is_active: formData.is_active
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                await updateUserMutation.mutateAsync({ userId: selectedUser.id, userData: updateData });
                toast.success('User updated successfully');
            }
            setIsModalOpen(false);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.detail || `Failed to ${modalMode} user`);
            } else {
                toast.error(errorMessage);
            }
        }
    };

    const toggleUserStatus = async (user: User) => {
        try {
            await updateUserMutation.mutateAsync({ userId: user.id, userData: { is_active: !user.is_active } });
            toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
        } catch {
            toast.error('Failed to update user status');
        }
    };

    const toggleAdminStatus = async (user: User) => {
        try {
            await updateUserMutation.mutateAsync({ userId: user.id, userData: { is_admin: !user.is_admin } });
            toast.success(`User updated successfully`);
        } catch {
            toast.error('Failed to update admin permissions');
        }
    };

    const deleteUser = async (userId: number) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            await deleteUserMutation.mutateAsync(userId);
            toast.success('User deleted successfully');
        } catch {
            toast.error('Failed to delete user');
        }
    };

    const safeUsers = Array.isArray(users) ? users : [];
    const filteredUsers = safeUsers.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'active' && user.is_active) ||
            (filterStatus === 'inactive' && !user.is_active);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="panel p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Users className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Access Control</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                {filteredUsers.filter(u => u.is_active).length} ACTIVE OPERATORS
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">Manage operator identities, security credentials, and role privileges</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleOpenModal('add')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:opacity-90 text-[#0f1115] rounded-[7px] text-xs font-semibold font-mono transition-opacity"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        + ADD OPERATOR
                    </button>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className="panel p-3 flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                    <input
                        type="text"
                        placeholder="Search operator by name, username or email..."
                        className="w-full bg-raised border border-line rounded-[7px] py-1.5 pl-9 pr-3 text-xs font-mono text-text focus:outline-none focus:border-accent transition-colors placeholder:text-faint"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <CustomSelect
                    options={[
                        { value: 'all', label: 'All Users' },
                        { value: 'active', label: 'Active Only' },
                        { value: 'inactive', label: 'Disabled Only' }
                    ]}
                    value={filterStatus}
                    onChange={(val) => setFilterStatus(val as any)}
                />
            </div>

            {/* ── Users Table ── */}
            <div className="panel p-0 overflow-hidden">
                <div className="panel-head border-b border-line px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-accent" />
                        <span className="font-mono text-xs uppercase tracking-wider text-text font-medium">Configured Operators</span>
                    </div>
                    <span className="text-faint text-xs font-mono">{filteredUsers.length} total</span>
                </div>

                <div className="table-wrap">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-line bg-raised/50 text-faint uppercase font-mono text-[10px] tracking-wider">
                                <th className="px-4 py-2 font-medium">Operator</th>
                                <th className="px-4 py-2 font-medium">Security Role</th>
                                <th className="px-4 py-2 font-medium text-center">Status</th>
                                <th className="px-4 py-2 font-medium text-center">Last Activity</th>
                                <th className="px-4 py-2 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            <AnimatePresence mode="popLayout">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-text-soft font-mono text-xs animate-pulse">
                                            Syncing operator directory...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-raised/60 transition-colors"
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-[5px] bg-raised border border-line flex items-center justify-center text-accent font-mono text-xs font-semibold">
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-text font-medium text-xs">{user.full_name || user.username}</div>
                                                    <div className="text-faint text-[10px] font-mono">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 font-mono">
                                            <button
                                                onClick={() => toggleAdminStatus(user)}
                                                className={cn(
                                                    "status text-[9px] uppercase px-1.5 py-0.5",
                                                    user.is_admin ? "warn" : "ok"
                                                )}
                                            >
                                                {user.is_admin ? 'Admin' : 'Operator'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono">
                                            <button
                                                onClick={() => toggleUserStatus(user)}
                                                className={cn(
                                                    "status text-[9px] uppercase px-1.5 py-0.5",
                                                    user.is_active ? "ok" : "danger"
                                                )}
                                            >
                                                {user.is_active ? 'Authorized' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono">
                                            <div className="text-text-soft text-xs num">
                                                {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                            </div>
                                            <div className="text-faint text-[9px]">Created {new Date(user.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleOpenModal('edit', user)}
                                                    aria-label={`Edit ${user.username}`}
                                                    className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text transition-colors"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(user.id)}
                                                    aria-label={`Delete ${user.username}`}
                                                    className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-danger hover:text-danger transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-text-soft font-mono text-xs">
                                            No matching operators found
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modal ── */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg"
                        >
                            <PremiumCard className="p-0 border-border bg-card shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-border flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -mr-16 -mt-16" />

                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                            {modalMode === 'add' ? <UserPlus className="w-6 h-6 text-primary" /> : <Edit2 className="w-6 h-6 text-primary" />}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-foreground tracking-tight uppercase">
                                                {modalMode === 'add' ? 'Provision Identity' : 'Update Credentials'}
                                            </h2>
                                            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-0.5">
                                                {modalMode === 'add' ? 'System Operator Enrollment' : `Modifying Token: ${selectedUser?.username}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        aria-label="Close dialog"
                                        className="relative z-10 p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Username</label>
                                                <input
                                                    type="text"
                                                    disabled={modalMode === 'edit'}
                                                    required
                                                    className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold tracking-tight disabled:opacity-30 placeholder:text-muted-foreground/40"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    placeholder="Operator handle..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold tracking-tight placeholder:text-muted-foreground/40"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                    placeholder="Real-world name..."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Identifier</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold tracking-tight placeholder:text-muted-foreground/40"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="address@domain.com"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                                                {modalMode === 'add' ? 'Access Cipher' : 'New Cipher (leave blank to retain)'}
                                            </label>
                                            <input
                                                type="password"
                                                required={modalMode === 'add'}
                                                className="w-full bg-secondary/40 border border-border rounded-2xl px-5 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono placeholder:text-muted-foreground/40"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 py-2">
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border">
                                                <div className="flex items-center gap-3">
                                                    <Shield className={cn("w-5 h-5", formData.is_admin ? "text-amber-500" : "text-muted-foreground/40")} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Privileged Access</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, is_admin: !formData.is_admin })}
                                                    aria-label="Toggle privileged admin access"
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-all border border-border",
                                                        formData.is_admin ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "bg-secondary"
                                                    )}
                                                >
                                                    <motion.div
                                                        animate={{ x: formData.is_admin ? 22 : 2 }}
                                                        className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg"
                                                    />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-border">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 className={cn("w-5 h-5", formData.is_active ? "text-emerald-500" : "text-muted-foreground/40")} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Authorized Status</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                    aria-label="Toggle user active status"
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-all border border-border",
                                                        formData.is_active ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
                                                    )}
                                                >
                                                    <motion.div
                                                        animate={{ x: formData.is_active ? 22 : 2 }}
                                                        className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-6 py-4 bg-secondary hover:bg-secondary/80 text-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-2 px-10 py-4 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-md active:scale-[0.98]"
                                        >
                                            {modalMode === 'add' ? 'Confirm Enrollment' : 'Sync Records'}
                                        </button>
                                    </div>
                                </form>
                            </PremiumCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserManagement;
