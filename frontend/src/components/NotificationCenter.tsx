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
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm border-l border-white/10 bg-[#0a0a0a] shadow-2xl"
                    >
                        <div className="flex h-full flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <Bell className="h-5 w-5 text-gray-400" />
                                    <h2 className="font-semibold text-gray-200">Notifications</h2>
                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                                            {unreadCount} New
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {notifications.length > 0 && (
                                        <>
                                            <button
                                                onClick={markAllAsRead}
                                                className="group rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                                title="Mark all as read"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={clearNotifications}
                                                className="group rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
                                                title="Clear all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                {notifications.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                                        <Bell className="h-12 w-12 opacity-20 mb-4" />
                                        <p className="font-medium">All caught up!</p>
                                        <p className="text-sm">No new notifications to show.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {notifications.map((notification) => (
                                            <motion.div
                                                key={notification.id}
                                                layout
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className={`relative rounded-xl border p-4 transition-colors ${notification.read
                                                        ? 'border-white/5 bg-white/[0.02]'
                                                        : 'border-blue-500/20 bg-blue-500/5'
                                                    }`}
                                                onClick={() => markAsRead(notification.id)}
                                            >
                                                {!notification.read && (
                                                    <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-blue-500" />
                                                )}
                                                <div className="flex gap-4">
                                                    <div className="mt-1 flex-shrink-0">
                                                        {getIcon(notification.type)}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <h3 className={`text-sm font-medium ${notification.read ? 'text-gray-300' : 'text-white'}`}>
                                                            {notification.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 leading-relaxed">
                                                            {notification.description}
                                                        </p>
                                                        <span className="text-[10px] text-gray-600">
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
