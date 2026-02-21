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

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'active' && user.is_active) ||
            (filterStatus === 'inactive' && !user.is_active);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            {/* ── Header ── */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 mb-2"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.15)]">
                            <Users className="w-6 h-6 text-indigo-400" />
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Access <span className="text-indigo-500">Control</span></h1>
                    </motion.div>
                    <p className="text-gray-400 font-medium text-sm ml-15">Manage system operators, permissions, and security profiles</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => handleOpenModal('add')}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Operator
                    </button>
                </div>
            </header>

            {/* ── Controls ── */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Quick search by name, username or email..."
                        className="w-full bg-[#111114]/50 backdrop-blur-md border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium placeholder:text-white/20"
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
                    className="w-full md:w-auto min-w-[180px]"
                />
            </div>

            {/* ── Users Table ── */}
            <PremiumCard className="overflow-hidden border-white/5 bg-[#111114]/30 backdrop-blur-2xl p-0">
                <div className="px-6 py-5 border-b border-white/[0.03] flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                            <Shield className="w-4.5 h-4.5 text-indigo-400" />
                        </div>
                        <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Active Operators</h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.05]">
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Operator</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Security Level</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-center">Last Activity</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            <AnimatePresence mode="popLayout">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                                <span className="text-white/40 font-mono text-[10px] uppercase tracking-[0.2em]">Syncing User Base...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length > 0 ? filteredUsers.map((user, idx) => (
                                    <motion.tr
                                        key={user.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="hover:bg-white/[0.02] transition-colors group"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 font-black">
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold tracking-tight">{user.full_name || user.username}</span>
                                                    <span className="text-white/30 text-[10px] uppercase font-black tracking-widest">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button
                                                onClick={() => toggleAdminStatus(user)}
                                                className={cn(
                                                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                                                    user.is_admin
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                                        : "bg-white/5 text-white/30 border-white/10 hover:text-white/60"
                                                )}
                                            >
                                                {user.is_admin ? 'Admin' : 'Junior'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <button
                                                onClick={() => toggleUserStatus(user)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                    user.is_active
                                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                        : "bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                                )}
                                            >
                                                {user.is_active ? 'Authorized' : 'Locked'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-white/80 font-bold font-mono text-[11px] tracking-tighter">
                                                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                                </span>
                                                <span className="text-white/20 text-[9px] uppercase font-black">Created {new Date(user.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal('edit', user)}
                                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-white hover:bg-indigo-600/50 hover:border-indigo-500/50 transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(user.id)}
                                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-rose-400 hover:bg-rose-600/20 hover:border-rose-500/30 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <Search className="w-12 h-12" />
                                                <span className="text-sm font-black uppercase tracking-widest">No matching operators found</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </PremiumCard>

            {/* ── Modal ── */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg"
                        >
                            <PremiumCard className="p-0 border-white/10 bg-[#0d0d0f] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[60px] rounded-full -mr-16 -mt-16" />

                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                                            {modalMode === 'add' ? <UserPlus className="w-6 h-6 text-indigo-400" /> : <Edit2 className="w-6 h-6 text-indigo-400" />}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white tracking-tight uppercase">
                                                {modalMode === 'add' ? 'Provision Identity' : 'Update Credentials'}
                                            </h2>
                                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-0.5">
                                                {modalMode === 'add' ? 'System Operator Enrollment' : `Modifying Token: ${selectedUser?.username}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="relative z-10 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Username</label>
                                                <input
                                                    type="text"
                                                    disabled={modalMode === 'edit'}
                                                    required
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-bold tracking-tight disabled:opacity-30 placeholder:text-white/10"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    placeholder="Operator handle..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-bold tracking-tight placeholder:text-white/10"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                    placeholder="Real-world name..."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Email Identifier</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-bold tracking-tight placeholder:text-white/10"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="address@domain.com"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">
                                                {modalMode === 'add' ? 'Access Cipher' : 'New Cipher (leave blank to retain)'}
                                            </label>
                                            <input
                                                type="password"
                                                required={modalMode === 'add'}
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono placeholder:text-white/10"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 py-2">
                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <Shield className={cn("w-5 h-5", formData.is_admin ? "text-amber-500" : "text-white/20")} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-white/80">Privileged Access</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, is_admin: !formData.is_admin })}
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-all border border-white/10",
                                                        formData.is_admin ? "bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "bg-white/5"
                                                    )}
                                                >
                                                    <motion.div
                                                        animate={{ x: formData.is_admin ? 22 : 2 }}
                                                        className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg"
                                                    />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 className={cn("w-5 h-5", formData.is_active ? "text-emerald-500" : "text-white/20")} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-white/80">Authorized Status</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-all border border-white/10",
                                                        formData.is_active ? "bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
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
                                            className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-[0.98]"
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
