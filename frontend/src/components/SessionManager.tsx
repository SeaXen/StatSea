import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Shield,
    Monitor,
    Smartphone,
    Globe,
    LogOut,
    Clock,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Loader2,
    History
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import axiosInstance from '../config/axiosInstance';
import { useAuth } from '../context/AuthContext';

interface Session {
    id: number;
    created_at: string;
    expires_at: string;
    user_agent: string | null;
    ip_address: string | null;
    is_current: boolean;
}

const SessionManager: React.FC = () => {
    const { refreshToken } = useAuth();
    const queryClient = useQueryClient();

    const { data: sessions, isLoading } = useQuery({
        queryKey: ['auth', 'sessions'],
        queryFn: async () => {
            const res = await axiosInstance.get(`/auth/sessions?current_token=${refreshToken}`);
            return res.data;
        },
        enabled: !!refreshToken
    });

    const revokeOthersMutation = useMutation({
        mutationFn: async () => {
            await axiosInstance.post('/auth/sessions/revoke-others', {
                refresh_token: refreshToken
            });
        },
        onSuccess: () => {
            toast.success('All other sessions have been revoked');
            queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
        },
        onError: () => {
            toast.error('Failed to revoke sessions');
        }
    });

    const getDeviceIcon = (ua: string | null) => {
        if (!ua) return Globe;
        const lowerUA = ua.toLowerCase();
        if (lowerUA.includes('mobile') || lowerUA.includes('android') || lowerUA.includes('iphone')) return Smartphone;
        return Monitor;
    };

    const parseUA = (ua: string | null) => {
        if (!ua) return 'Unknown Device';
        // Simple parser for common browsers/OS
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Macintosh')) return 'MacBook / iMac';
        if (ua.includes('Linux')) return 'Linux Device';
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('Android')) return 'Android Phone';
        return 'Web Browser';
    };

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateStr));
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                    Active Sessions
                </h1>
                <p className="text-muted-foreground">
                    Manage your active logins across different devices and browsers.
                </p>
            </header>

            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-black/20 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Current Login</h3>
                            <p className="text-sm text-muted-foreground">You are currently using this device.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => revokeOthersMutation.mutate()}
                        disabled={revokeOthersMutation.isPending || sessions?.length <= 1}
                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                    >
                        {revokeOthersMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                        Logout Other Devices
                    </button>
                </div>

                <div className="space-y-4">
                    {sessions?.map((session: Session) => {
                        const Icon = getDeviceIcon(session.user_agent);
                        const isCurrent = session.is_current;

                        return (
                            <motion.div
                                key={session.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex items-center justify-between p-4 rounded-xl border ${isCurrent ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/5 border-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${isCurrent ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/40'}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white">
                                                {parseUA(session.user_agent)}
                                            </span>
                                            {isCurrent && (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {session.ip_address || 'Unknown IP'}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Started {formatDate(session.created_at)}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <History className="w-3 h-3" />
                                                Expires {formatDate(session.expires_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {!isCurrent && (
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Active
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200/60 leading-relaxed">
                    If you see a login from a device you don't recognize, we recommend revoking its access immediately and changing your password to keep your account secure.
                </div>
            </div>
        </div>
    );
};

export default SessionManager;
