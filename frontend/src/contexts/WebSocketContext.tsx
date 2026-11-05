/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
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

interface WsDataState {
    wsData: Record<string, unknown>[];
    isConnected: boolean;
    isSynthetic: boolean;
    notifications: Notification[];
    unreadCount: number;
}

interface WsActionsState {
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

type CombinedWsContextType = WsDataState & WsActionsState;

const WsDataContext = createContext<WsDataState | undefined>(undefined);
const WsActionsContext = createContext<WsActionsState | undefined>(undefined);
const WebSocketContext = createContext<CombinedWsContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
    const [wsData, setWsData] = useState<Record<string, unknown>[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isSynthetic, setIsSynthetic] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const { token } = useAuth();

    useEffect(() => {
        let ws: WebSocket | null = null;
        let eventWs: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let isMounted = true;
        let reconnectAttempt = 0;
        const MAX_RECONNECT_DELAY = 30000;

        if (!token) return;

        const getReconnectDelay = () => {
            return Math.min(1000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
        };

        const scheduleReconnect = () => {
            if (!isMounted) return;
            clearTimeout(reconnectTimeout);
            reconnectAttempt++;
            const delay = getReconnectDelay();
            reconnectTimeout = setTimeout(connect, delay);
        };

        const connect = () => {
            if (!isMounted) return;

            try {
                const wsUrl = `${getWsUrl('/ws/live')}?token=${token}`;
                const eventWsUrl = `${getWsUrl('/ws/events')}?token=${token}`;

                ws = new WebSocket(wsUrl);
                eventWs = new WebSocket(eventWsUrl);

                ws.onopen = () => {
                    if (isMounted) {
                        setIsConnected(true);
                        reconnectAttempt = 0;
                        toast.success('Connected to Live Server');
                    }
                };

                ws.onclose = () => {
                    if (isMounted) {
                        setIsConnected(false);
                        scheduleReconnect();
                    }
                };

                ws.onerror = () => {
                    if (isMounted) {
                        setIsConnected(false);
                    }
                };

                eventWs.onclose = () => {
                    if (isMounted) {
                        scheduleReconnect();
                    }
                };

                let lastUpdate = 0;
                const THROTTLE_MS = 500;

                ws.onmessage = (event) => {
                    const now = Date.now();
                    if (now - lastUpdate < THROTTLE_MS) return;
                    lastUpdate = now;

                    try {
                        const data = JSON.parse(event.data);

                        // Respond to server ping heartbeat
                        if (data.type === 'ping') {
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                try {
                                    ws.send(JSON.stringify({ type: 'pong' }));
                                } catch {
                                    // ignore send error
                                }
                            }
                            return;
                        }

                        if (typeof data.is_synthetic === 'boolean') {
                            setIsSynthetic(data.is_synthetic);
                        }

                        setWsData(prev => {
                            const newData = [...prev, {
                                time: new Date(data.timestamp * 1000).toLocaleTimeString(),
                                upload: (data.u || 0) / 1024,
                                download: (data.d || 0) / 1024,
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
                        if (data.type === 'ping') return;

                        const newNotification: Notification = {
                            id: Math.random().toString(36).substring(2, 11),
                            title: data.title || 'New Event',
                            description: data.description || '',
                            timestamp: new Date(),
                            read: false,
                            type: data.type === 'error' ? 'error' :
                                data.type === 'warning' ? 'warning' :
                                    data.type === 'success' ? 'success' : 'info'
                        };

                        setNotifications(prev => [newNotification, ...prev]);

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
            } catch (err) {
                console.error("WebSocket connection initiation error", err);
                scheduleReconnect();
            }
        };

        connect();

        return () => {
            isMounted = false;
            clearTimeout(reconnectTimeout);
            if (ws) {
                ws.onopen = null;
                ws.onclose = null;
                ws.onerror = null;
                ws.onmessage = null;
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            }
            if (eventWs) {
                eventWs.onopen = null;
                eventWs.onclose = null;
                eventWs.onerror = null;
                eventWs.onmessage = null;
                if (eventWs.readyState === WebSocket.OPEN || eventWs.readyState === WebSocket.CONNECTING) {
                    eventWs.close();
                }
            }
        };
    }, [token]);

    const dataValue = useMemo(() => ({
        wsData,
        isConnected,
        isSynthetic,
        notifications,
        unreadCount,
    }), [wsData, isConnected, isSynthetic, notifications, unreadCount]);

    const actionsValue = useMemo(() => ({
        markAsRead,
        markAllAsRead,
        clearNotifications,
    }), [markAsRead, markAllAsRead, clearNotifications]);

    const combinedValue = useMemo(() => ({
        ...dataValue,
        ...actionsValue,
    }), [dataValue, actionsValue]);

    return (
        <WsActionsContext.Provider value={actionsValue}>
            <WsDataContext.Provider value={dataValue}>
                <WebSocketContext.Provider value={combinedValue}>
                    {children}
                </WebSocketContext.Provider>
            </WsDataContext.Provider>
        </WsActionsContext.Provider>
    );
};

export const useWsData = () => {
    const context = useContext(WsDataContext);
    if (context === undefined) {
        throw new Error('useWsData must be used within a WebSocketProvider');
    }
    return context;
};

export const useWsActions = () => {
    const context = useContext(WsActionsContext);
    if (context === undefined) {
        throw new Error('useWsActions must be used within a WebSocketProvider');
    }
    return context;
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
