import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Search,
    Cpu,
    Database,
    Box,
    Activity,
    ArrowUpDown
} from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';

interface ResourceProcess {
    id: string;
    name: string;
    cpu: number;
    ram: number;
    type: 'Process' | 'Container';
    status: string;
}

interface SystemDetailOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialType?: 'cpu' | 'ram' | 'disk' | 'all';
}

const SystemDetailOverlay: React.FC<SystemDetailOverlayProps> = ({ isOpen, onClose, initialType = 'all' }) => {
    const [processes, setProcesses] = useState<ResourceProcess[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'Process' | 'Container'>('all');
    const [sortField, setSortField] = useState<'cpu' | 'ram' | 'name'>('cpu');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const fetchProcesses = async () => {
        try {
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SYSTEM.PROCESSES}`);
            const data = await res.json();
            setProcesses(data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch processes:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchProcesses();
            const interval = setInterval(fetchProcesses, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const filteredAndSorted = useMemo(() => {
        return processes
            .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesType = filterType === 'all' || p.type === filterType;
                return matchesSearch && matchesType;
            })
            .sort((a, b) => {
                const modifier = sortDirection === 'asc' ? 1 : -1;
                if (typeof a[sortField] === 'string') {
                    return (a[sortField] as string).localeCompare(b[sortField] as string) * modifier;
                }
                return ((a[sortField] as number) - (b[sortField] as number)) * modifier;
            });
    }, [processes, searchTerm, filterType, sortField, sortDirection]);

    const toggleSort = (field: 'cpu' | 'ram' | 'name') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-4 md:inset-10 lg:inset-20 bg-[#0A0B0E] border border-white/5 rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <Activity className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Resource Management</h2>
                                    <p className="text-white/40 text-sm">Real-time status of system processes and containers</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all border border-transparent hover:border-white/10"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                                {(['all', 'Process', 'Container'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === type
                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : 'text-white/40 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-[#0A0B0E] z-10">
                                    <tr className="border-b border-white/5">
                                        <th className="px-6 py-4 text-white/40 text-[10px] uppercase font-bold tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('name')}>
                                            <div className="flex items-center gap-2">
                                                <span>Application / Process</span>
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-white/40 text-[10px] uppercase font-bold tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-white/40 text-[10px] uppercase font-bold tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-white/40 text-[10px] uppercase font-bold tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('cpu')}>
                                            <div className="flex items-center gap-2">
                                                <Cpu className="w-3 h-3" />
                                                <span>CPU %</span>
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-white/40 text-[10px] uppercase font-bold tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('ram')}>
                                            <div className="flex items-center gap-2">
                                                <Database className="w-3 h-3" />
                                                <span>RAM (MB)</span>
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-white/20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                                    <span>Analyzing resource usage...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAndSorted.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-white/20">
                                                No processes found matching your criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAndSorted.map((p) => (
                                            <motion.tr
                                                layout
                                                key={p.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${p.type === 'Container'
                                                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                            }`}>
                                                            {p.type === 'Container' ? <Box className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                                        </div>
                                                        <span className="text-white font-medium text-sm truncate max-w-[200px] md:max-w-md">
                                                            {p.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${p.type === 'Container'
                                                        ? 'text-purple-400 border-purple-400/20 bg-purple-400/5'
                                                        : 'text-blue-400 border-blue-400/20 bg-blue-400/5'
                                                        }`}>
                                                        {p.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'running' ? 'bg-emerald-500' : 'bg-white/20'
                                                            }`} />
                                                        <span className="text-white/60 text-xs capitalize">{p.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-mono w-12 text-right ${p.cpu > 50 ? 'text-red-400' : 'text-white'}`}>
                                                            {p.cpu.toFixed(1)}%
                                                        </span>
                                                        <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${p.cpu > 50 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${Math.min(p.cpu, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-mono w-16 text-right ${p.ram > 1024 ? 'text-purple-400' : 'text-white'}`}>
                                                            {p.ram.toFixed(0)} MB
                                                        </span>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-white/30">
                            <div className="flex items-center gap-4">
                                <span>Total: {processes.length} items</span>
                                <span>Updating every 3s</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Live System Monitor</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default SystemDetailOverlay;
