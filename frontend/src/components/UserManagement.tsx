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

import { useModalA11y } from '../hooks/useModalA11y';

export const UserManagement: React.FC = () => {
    const { data: users = [], isLoading } = useUsers() as { data: User[]; isLoading: boolean };
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const modalRef = useModalA11y<HTMLDivElement>({ isOpen: isModalOpen, onClose: () => setIsModalOpen(false) });
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

    const deleteUser = (userId: number) => {
        toast('Delete user account?', {
            description: 'This action cannot be undone and will revoke all active sessions.',
            action: {
                label: 'Delete',
                onClick: async () => {
                    try {
                        await deleteUserMutation.mutateAsync(userId);
                        toast.success('User deleted successfully');
                    } catch {
                        toast.error('Failed to delete user');
                    }
                }
            }
        });
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
                        type="button"
                        onClick={() => handleOpenModal('add')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:opacity-90 text-accent-foreground rounded-[7px] text-xs font-semibold font-mono transition-opacity shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
                        placeholder="Search operator by name, username or email…"
                        aria-label="Search operator by name, username or email"
                        className="w-full bg-raised border border-line rounded-[7px] py-1.5 pl-9 pr-3 text-xs font-mono text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors placeholder:text-faint"
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
                    onChange={(val) => setFilterStatus(val as 'all' | 'active' | 'inactive')}
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
                                            Syncing operator directory…
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
                                                type="button"
                                                onClick={() => toggleAdminStatus(user)}
                                                className={cn(
                                                    "status text-[9px] uppercase px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                    user.is_admin ? "warn" : "ok"
                                                )}
                                            >
                                                {user.is_admin ? 'Admin' : 'Operator'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono">
                                            <button
                                                type="button"
                                                onClick={() => toggleUserStatus(user)}
                                                className={cn(
                                                    "status text-[9px] uppercase px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                    user.is_active ? "ok" : "offline"
                                                )}
                                            >
                                                {user.is_active ? 'Authorized' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-mono">
                                            <div className="text-text-soft text-xs num">
                                                {user.last_login ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(user.last_login)) : 'Never'}
                                            </div>
                                            <div className="text-faint text-[9px]">Created {new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(user.created_at))}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenModal('edit', user)}
                                                    aria-label={`Edit ${user.username}`}
                                                    className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-text-soft hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteUser(user.id)}
                                                    aria-label={`Delete ${user.username}`}
                                                    className="w-7 h-7 flex items-center justify-center rounded-[5px] bg-raised hover:bg-line-strong border border-line text-danger hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
                            <div
                                ref={modalRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="user-modal-title"
                                tabIndex={-1}
                                className="panel p-0 border border-line bg-panel shadow-2xl overflow-hidden rounded-[var(--r-panel)]"
                            >
                                <div className="p-5 border-b border-line bg-raised flex justify-between items-center relative overflow-hidden">
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="w-9 h-9 rounded-[7px] bg-accent/10 flex items-center justify-center border border-accent/20">
                                            {modalMode === 'add' ? <UserPlus className="w-4 h-4 text-accent" /> : <Edit2 className="w-4 h-4 text-accent" />}
                                        </div>
                                        <div>
                                            <h2 id="user-modal-title" className="text-base font-bold text-text tracking-tight uppercase">
                                                {modalMode === 'add' ? 'Provision Identity' : 'Update Credentials'}
                                            </h2>
                                            <p className="text-faint text-[10px] font-mono uppercase tracking-wider mt-0.5">
                                                {modalMode === 'add' ? 'System Operator Enrollment' : `Modifying Token: ${selectedUser?.username}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        aria-label="Close dialog"
                                        className="relative z-10 p-1.5 rounded-[5px] hover:bg-panel text-faint hover:text-text transition-colors border border-transparent hover:border-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label htmlFor="user-username-input" className="text-[10px] font-bold text-faint uppercase tracking-wider">Username</label>
                                                <input
                                                    id="user-username-input"
                                                    type="text"
                                                    autoComplete="username"
                                                    disabled={modalMode === 'edit'}
                                                    required
                                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-2 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors font-mono disabled:opacity-40 placeholder:text-faint"
                                                    value={formData.username}
                                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                    placeholder="Operator handle…"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label htmlFor="user-fullname-input" className="text-[10px] font-bold text-faint uppercase tracking-wider">Full Name</label>
                                                <input
                                                    id="user-fullname-input"
                                                    type="text"
                                                    autoComplete="name"
                                                    required
                                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-2 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors font-mono placeholder:text-faint"
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                    placeholder="Real-world name…"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label htmlFor="user-email-input" className="text-[10px] font-bold text-faint uppercase tracking-wider">Email Identifier</label>
                                            <input
                                                id="user-email-input"
                                                type="email"
                                                autoComplete="email"
                                                required
                                                className="w-full bg-raised border border-line rounded-[7px] px-3 py-2 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors font-mono placeholder:text-faint"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="address@domain.com"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label htmlFor="user-password-input" className="text-[10px] font-bold text-faint uppercase tracking-wider">
                                                {modalMode === 'add' ? 'Access Cipher' : 'New Cipher (leave blank to retain)'}
                                            </label>
                                            <input
                                                id="user-password-input"
                                                type="password"
                                                autoComplete="new-password"
                                                required={modalMode === 'add'}
                                                className="w-full bg-raised border border-line rounded-[7px] px-3 py-2 text-xs text-text focus:outline-none focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors font-mono placeholder:text-faint"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 pt-1">
                                            <div className="flex items-center justify-between p-3 rounded-[7px] bg-raised border border-line">
                                                <div className="flex items-center gap-2.5">
                                                    <Shield className={cn("w-4 h-4", formData.is_admin ? "text-amber-400" : "text-faint")} />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-text">Privileged Access</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={formData.is_admin}
                                                    onClick={() => setFormData({ ...formData, is_admin: !formData.is_admin })}
                                                    aria-label="Toggle privileged admin access"
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-colors border border-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                        formData.is_admin ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "bg-panel"
                                                    )}
                                                >
                                                    <motion.div
                                                        animate={{ x: formData.is_admin ? 22 : 2 }}
                                                        className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm"
                                                    />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-[7px] bg-raised border border-line">
                                                <div className="flex items-center gap-2.5">
                                                    <CheckCircle2 className={cn("w-4 h-4", formData.is_active ? "text-emerald-400" : "text-faint")} />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-text">Authorized Status</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={formData.is_active}
                                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                    aria-label="Toggle user active status"
                                                    className={cn(
                                                        "w-10 h-5 rounded-full relative transition-colors border border-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                                                        formData.is_active ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.2)]"
                                                    )}
                                                >
                                                    <motion.div
                                                        animate={{ x: formData.is_active ? 22 : 2 }}
                                                        className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-4 py-2 bg-raised hover:bg-panel text-faint hover:text-text text-xs font-bold uppercase tracking-wider rounded-[5px] border border-line transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 bg-accent hover:opacity-90 text-black text-xs font-bold uppercase tracking-wider rounded-[5px] transition-colors shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                        >
                                            {modalMode === 'add' ? 'Confirm Enrollment' : 'Sync Records'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserManagement;
