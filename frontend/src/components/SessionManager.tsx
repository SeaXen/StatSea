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
    Loader2,
    History
} from 'lucide-react';
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
        <div className="space-y-4">
            {/* Header */}
            <div className="panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Shield className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">Active Sessions</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                {sessions?.length || 0} CONCURRENT
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">
                            Manage and revoke active authenticated tokens across client browsers
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => revokeOthersMutation.mutate()}
                    disabled={revokeOthersMutation.isPending || (sessions?.length || 0) <= 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-raised hover:bg-line-strong border border-line text-danger hover:text-danger font-mono text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {revokeOthersMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                    REVOKE OTHERS
                </button>
            </div>

            <div className="panel p-0 overflow-hidden">
                <div className="panel-head border-b border-line px-4 py-2.5 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-text font-medium">Session Ledger</span>
                    <span className="text-faint text-xs font-mono">{sessions?.length || 0} active</span>
                </div>

                <div className="p-3 space-y-2">
                    {sessions?.map((session: Session) => {
                        const Icon = getDeviceIcon(session.user_agent);
                        const isCurrent = session.is_current;

                        return (
                            <div
                                key={session.id}
                                className={`flex items-center justify-between p-3 rounded-[7px] border transition-colors ${
                                    isCurrent ? 'bg-raised/80 border-accent/40' : 'bg-panel border-line hover:border-line-strong'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-[5px] flex items-center justify-center border ${
                                        isCurrent ? 'bg-accent/15 border-accent text-accent' : 'bg-raised border-line text-text-soft'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-text">
                                                {parseUA(session.user_agent)}
                                            </span>
                                            {isCurrent && (
                                                <span className="status ok text-[9px] uppercase font-mono px-1.5 py-0.2">
                                                    CURRENT DEVICE
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 font-mono text-[11px] text-faint">
                                            <span className="flex items-center gap-1 text-text-soft">
                                                <MapPin className="w-3 h-3" />
                                                {session.ip_address || 'Unknown IP'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Started {formatDate(session.created_at)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <History className="w-3 h-3" />
                                                Expires {formatDate(session.expires_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {!isCurrent && (
                                    <span className="status ok text-[9px] uppercase font-mono px-1.5 py-0.5">
                                        ACTIVE
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="panel p-3 border-line flex items-center gap-3 font-mono text-xs text-text-soft">
                <AlertCircle className="w-4 h-4 text-warn shrink-0" />
                <span>
                    If you identify an unrecognized active session, revoke it immediately and update your master passphrase.
                </span>
            </div>
        </div>
    );
};

export default SessionManager;
