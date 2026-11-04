/// <reference types="vite/client" />
// Dynamic API & WebSocket Configuration for both Local Dev (Vite) and Production (Docker/Nginx)
const isLocalDevVite = typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '5174');
const API_PORT = import.meta.env.VITE_API_PORT || (isLocalDevVite ? '8001' : window.location.port || '80');
const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';

const resolveBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window === 'undefined') return 'http://localhost:8001/api';
    // When served via Nginx in Docker (e.g. port 21080 or reverse proxy)
    if (!isLocalDevVite) return `${window.location.origin}/api`;
    return `http://${window.location.hostname}:${API_PORT}/api`;
};

const resolveWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    if (typeof window === 'undefined') return 'ws://localhost:8001/api';
    const wsProto = isSecure ? 'wss:' : 'ws:';
    if (!isLocalDevVite) return `${wsProto}//${window.location.host}/api`;
    return `${wsProto}//${window.location.hostname}:${API_PORT}/api`;
};

export const API_CONFIG = {
    BASE_URL: resolveBaseUrl(),
    WS_URL: resolveWsUrl(),
    ENDPOINTS: {
        HEALTH: '/health',
        ANALYTICS: {
            SUMMARY: '/analytics/summary',
            HISTORY: '/network/history',
            PACKETS: '/analytics/packets',
            PREDICTION: '/analytics/prediction',
            ANOMALIES: '/analytics/anomalies',
            HEATMAP: '/analytics/heatmap',
            HISTORY_SYSTEM: '/analytics/history/system',
            HISTORY_DEVICE: (mac: string) => `/analytics/history/device/${mac}`,
            YEARLY: '/analytics/yearly',
            TRAFFIC_CATEGORIES: '/analytics/traffic-categories',
        },
        SECURITY: {
            EVENTS: '/security/events',
            ALERTS: '/alerts',
            RULES: '/alerts/rules',
            RESOLVE: (id: number) => `/alerts/${id}/resolve`,
        },
        NETWORK: {
            CONNECTIONS: '/network/connections',
        },
        DOCKER: {
            CONTAINERS: '/docker/containers',
            LOGS: (id: string) => `/docker/containers/${id}/logs`,
            HISTORY: (id: string) => `/docker/${id}/history`,
            USAGE: (id: string) => `/docker/${id}/usage`,
            PRUNE: '/docker/prune',
        },
        DEVICES: {
            LIST: '/devices',
            GROUPS: '/groups',
            WAKE: (mac: string) => `/devices/${mac}/wake`,
        },
        SPEEDTEST: '/speedtest',
        SETTINGS: '/settings',
        SYSTEM: {
            INFO: '/system/info',
            PROCESSES: '/system/processes',
        },
        DNS: {
            LOGS: '/analytics/dns-logs',
            TOP: '/analytics/dns-logs/top',
        },
        QUOTA: {
            BASE: '/quotas',
            BY_ID: (id: number) => `/quotas/${id}`,
        },
        AUTH: {
            LOGOUT: '/auth/logout',
            ME: '/auth/me',
        },
        ADMIN: {
            AUDIT_LOG: '/admin/audit-log',
        },
        NOTIFICATIONS: {
            CHANNELS: '/notifications/channels',
            CHANNEL_BY_ID: (id: number) => `/notifications/channels/${id}`,
            TEST_CHANNEL: (id: number) => `/notifications/channels/${id}/test`,
            PUSH_SUBSCRIPTION: '/notifications/push/subscribe',
        },
        BANDWIDTH: {
            INTERFACES: '/bandwidth/interfaces',
            SUMMARY: '/bandwidth/summary',
            FIVEMINUTE: '/bandwidth/fiveminute',
            HOURLY: '/bandwidth/hourly',
            DAILY: '/bandwidth/daily',
            MONTHLY: '/bandwidth/monthly',
            YEARLY: '/bandwidth/yearly',
            TOP: '/bandwidth/top',
        },
        CERTIFICATES: {
            BASE: '/certificates',
            BY_ID: (id: number) => `/certificates/${id}`,
        }
    }
} as const; // Add 'as const' to infer literal types correctly

export const getWsUrl = (path: string) => `${API_CONFIG.WS_URL}${path}`;
