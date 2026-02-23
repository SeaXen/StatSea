import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { getWsUrl } from '../config/apiConfig';
import { useAuth } from '../context/AuthContext';

export interface Notification {
    id: string;
    title: string;
    description: string;
    timestamp: Date;
    read: boolean;
    type: 'info' | 'warning' | 'error' | 'success';
}

interface WebSocketContextType {
    wsData: Record<string, unknown>[];
    isConnected: boolean;
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
    const [wsData, setWsData] = useState<Record<string, unknown>[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearNotifications = () => {
        setNotifications([]);
    };

    const { token } = useAuth();

    useEffect(() => {
        let ws: WebSocket | null = null;
        let eventWs: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let isMounted = true;
        let reconnectAttempt = 0;
        const MAX_RECONNECT_DELAY = 30000; // 30 seconds max

        if (!token) return;

        const getReconnectDelay = () => {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
            return delay;
        };

        const connect = () => {
            const wsUrl = `${getWsUrl('/ws/live')}?token=${token}`;
            const eventWsUrl = `${getWsUrl('/ws/events')}?token=${token}`;

            ws = new WebSocket(wsUrl);
            eventWs = new WebSocket(eventWsUrl);

            ws.onopen = () => {
                if (isMounted) {
                    setIsConnected(true);
                    reconnectAttempt = 0; // Reset backoff on successful connect
                    toast.success('Connected to Live Server');
                }
            };

            ws.onclose = () => {
                if (isMounted) {
                    setIsConnected(false);
                    reconnectAttempt++;
                    const delay = getReconnectDelay();
                    reconnectTimeout = setTimeout(connect, delay);
                }
            };

            let lastUpdate = 0;
            const THROTTLE_MS = 500; // Max 2 updates per second

            ws.onmessage = (event) => {
                const now = Date.now();
                if (now - lastUpdate < THROTTLE_MS) return;
                lastUpdate = now;

                try {
                    const data = JSON.parse(event.data);

                    // Handle heartbeat ping from server
                    if (data.type === 'ping') return;

                    setWsData(prev => {
                        const newData = [...prev, {
                            time: new Date(data.timestamp * 1000).toLocaleTimeString(),
                            upload: data.u / 1024,
                            download: data.d / 1024,
                        }];
                        if (newData.length > 20) newData.shift();
                        return newData;
                    });
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            eventWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Add to notifications list
                    const newNotification: Notification = {
                        id: Math.random().toString(36).substr(2, 9),
                        title: data.title || 'New Event',
                        description: data.description || '',
                        timestamp: new Date(),
                        read: false,
                        type: data.type === 'error' ? 'error' :
                            data.type === 'warning' ? 'warning' :
                                data.type === 'success' ? 'success' : 'info'
                    };

                    setNotifications(prev => [newNotification, ...prev]);

                    // Show toast for high priority events or new devices
                    if (data.type === 'NEW_DEVICE' || data.type === 'security_alert') {
                        toast.warning(data.title, {
                            description: data.description,
                            duration: 5000,
                        });
                    } else {
                        toast.info(data.title, {
                            description: data.description,
                        });
                    }

                } catch (e) {
                    console.error("Failed to parse event message", e);
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            if (ws) ws.close();
            if (eventWs) eventWs.close();
            clearTimeout(reconnectTimeout);
        };
    }, [token]);

    return (
        <WebSocketContext.Provider value={{
            wsData,
            isConnected,
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            clearNotifications
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
