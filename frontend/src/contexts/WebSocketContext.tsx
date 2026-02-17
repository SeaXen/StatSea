import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { getWsUrl } from '../config/apiConfig';

interface WebSocketContextType {
    wsData: any[];
    isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
    const [wsData, setWsData] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const wsUrl = getWsUrl('/api/ws/live');
        const eventWsUrl = getWsUrl('/api/ws/events');

        const ws = new WebSocket(wsUrl);
        const eventWs = new WebSocket(eventWsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            toast.success('Connected to Live Server');
        };

        ws.onclose = () => {
            setIsConnected(false);
            toast.error('Disconnected from Live Server');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
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
                if (data.type === 'NEW_DEVICE') {
                    toast.warning(data.title, {
                        description: data.description,
                        duration: 5000,
                    });
                }
            } catch (e) {
                console.error("Failed to parse event message", e);
            }
        };

        return () => {
            ws.close();
            eventWs.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ wsData, isConnected }}>
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
