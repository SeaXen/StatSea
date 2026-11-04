import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Bell, AlertTriangle, Info, CheckCircle, ShieldAlert } from 'lucide-react';
import { useWebSocket, Notification } from '../contexts/WebSocketContext';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useWebSocket();

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'error': return <ShieldAlert className="h-5 w-5 text-red-400" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-400" />;
            case 'success': return <CheckCircle className="h-5 w-5 text-green-400" />;
            default: return <Info className="h-5 w-5 text-blue-400" />;
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
                        className="fixed inset-0 z-50 bg-[#0f1115]/75"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm border-l border-line bg-panel shadow-2xl"
                    >
                        <div className="flex h-full flex-col font-sans">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-bar">
                                <div className="flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-accent" />
                                    <h2 className="font-semibold text-xs text-text uppercase tracking-wider font-mono">System Telemetry Log</h2>
                                    {unreadCount > 0 && (
                                        <span className="status warn text-[9px] font-mono px-1.5 py-0.2">
                                            {unreadCount} NEW
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {notifications.length > 0 && (
                                        <>
                                            <button
                                                onClick={markAllAsRead}
                                                className="p-1 rounded-[5px] text-muted hover:text-text hover:bg-raised transition-colors"
                                                title="Mark all as read"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={clearNotifications}
                                                className="p-1 rounded-[5px] text-muted hover:text-danger hover:bg-raised transition-colors"
                                                title="Clear all"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="p-1 rounded-[5px] text-muted hover:text-text hover:bg-raised transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-3 py-3">
                                {notifications.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-center text-muted font-mono text-xs">
                                        <Bell className="h-8 w-8 opacity-20 mb-3 text-muted" />
                                        <p className="font-semibold text-text">Zero Unread Events</p>
                                        <p className="text-[11px] text-faint mt-1">Audit log is clear</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {notifications.map((notification) => (
                                            <motion.div
                                                key={notification.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                className={`relative rounded-[7px] border p-3 transition-colors cursor-pointer ${notification.read
                                                    ? 'border-line bg-raised/30 text-text-soft'
                                                    : 'border-line-strong bg-raised text-text'
                                                    }`}
                                                onClick={() => markAsRead(notification.id)}
                                            >
                                                {!notification.read && (
                                                    <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent" />
                                                )}
                                                <div className="flex gap-2.5">
                                                    <div className="mt-0.5 flex-shrink-0">
                                                        {getIcon(notification.type)}
                                                    </div>
                                                    <div className="flex-1 space-y-0.5">
                                                        <h3 className={`text-xs font-semibold ${notification.read ? 'text-text-soft' : 'text-text'}`}>
                                                            {notification.title}
                                                        </h3>
                                                        <p className="text-[11px] text-text-soft leading-relaxed font-mono">
                                                            {notification.description}
                                                        </p>
                                                        <span className="text-[9.5px] font-mono text-faint block mt-1">
                                                            {new Date(notification.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
