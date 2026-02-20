import React, { useState, useEffect } from 'react';
import axios from 'axios';
import axiosInstance from '../config/axiosInstance';
import {
    Users,
    UserPlus,
    Search,
    Edit2,
    Trash2,
    Shield,
    Mail,
    Calendar,
    CheckCircle2,
    XCircle,
    UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

    useEffect(() => {
        // Load from cache initially
        const cachedUsers = localStorage.getItem('statsea_cache_users');
        if (cachedUsers) {
            setUsers(JSON.parse(cachedUsers));
            setIsLoading(false);
        }
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            if (!localStorage.getItem('statsea_cache_users')) {
                setIsLoading(true);
            }
            const response = await axiosInstance.get('/admin/users');
            setUsers(response.data);
            localStorage.setItem('statsea_cache_users', JSON.stringify(response.data));
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                await axiosInstance.post('/admin/users', formData);
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
                await axiosInstance.put(`/admin/users/${selectedUser.id}`, updateData);
                toast.success('User updated successfully');
            }
            setIsModalOpen(false);
            fetchUsers();
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
            await axiosInstance.put(`/admin/users/${user.id}`, {
                is_active: !user.is_active
            });
            toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
            fetchUsers();
        } catch {
            toast.error('Failed to update user status');
        }
    };

    const toggleAdminStatus = async (user: User) => {
        try {
            await axiosInstance.put(`/admin/users/${user.id}`, {
                is_admin: !user.is_admin
            });
            toast.success(`User updated successfully`);
            fetchUsers();
        } catch {
            toast.error('Failed to update admin permissions');
        }
    };

    const deleteUser = async (userId: number) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            await axiosInstance.delete(`/admin/users/${userId}`);
            toast.success('User deleted successfully');
            fetchUsers();
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
        <div className="p-6 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-500" />
                        User Management
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage system access, roles, and profiles</p>
                </div>
                <button
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm font-medium"
                    onClick={() => handleOpenModal('add')}
                >
                    <UserPlus className="w-4 h-4" />
                    Add User
                </button>
            </header>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name, username or email..."
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-900/50 text-slate-400 border border-slate-800'}`}
                    >
                        All Users
                    </button>
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-900/50 text-slate-400 border border-slate-800'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilterStatus('inactive')}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${filterStatus === 'inactive' ? 'bg-red-600 text-white' : 'bg-slate-900/50 text-slate-400 border border-slate-800'}`}
                    >
                        Inactive
                    </button>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Security Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Last Login</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        <AnimatePresence>
                            {filteredUsers.map((user) => (
                                <motion.tr
                                    key={user.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hover:bg-white/5 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                                                <UserCircle className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-white">{user.full_name || user.username}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div
                                            onClick={() => toggleAdminStatus(user)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 ${user.is_admin ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                                        >
                                            <Shield className="w-3 h-3" />
                                            {user.is_admin ? 'Administrator' : 'General User'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div
                                            onClick={() => toggleUserStatus(user)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 ${user.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                                        >
                                            {user.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {user.is_active ? 'Active' : 'Disabled'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col text-xs">
                                            <span className="text-slate-300 font-medium">
                                                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                            </span>
                                            <span className="text-slate-500 flex items-center gap-1 mt-0.5">
                                                <Calendar className="w-3 h-3" />
                                                Joined {new Date(user.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                onClick={() => handleOpenModal('edit', user)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                onClick={() => deleteUser(user.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                        {filteredUsers.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-12 h-12 text-slate-700" />
                                        <p className="text-slate-500 font-medium">No users found matching your criteria</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    Loading users...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {modalMode === 'add' ? <UserPlus className="w-5 h-5 text-blue-500" /> : <Edit2 className="w-5 h-5 text-blue-500" />}
                                    {modalMode === 'add' ? 'Add New User' : 'Edit User'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-slate-500 hover:text-white transition-colors"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username</label>
                                    <input
                                        type="text"
                                        disabled={modalMode === 'edit'}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="johndoe"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        {modalMode === 'add' ? 'Password' : 'New Password (Optional)'}
                                    </label>
                                    <input
                                        type="password"
                                        required={modalMode === 'add'}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">Administrator Access</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Elevated Permissions</div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_admin: !formData.is_admin })}
                                        className={`w-12 h-6 rounded-full transition-all relative ${formData.is_admin ? 'bg-blue-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.is_admin ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">Account Status</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Active / Disabled</div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`w-12 h-6 rounded-full transition-all relative ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.is_active ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                    >
                                        {modalMode === 'add' ? 'Create User' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
