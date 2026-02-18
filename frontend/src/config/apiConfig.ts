/// <reference types="vite/client" />
// Basic API Configuration
const API_PORT = import.meta.env.VITE_API_PORT || '21081';
export const API_CONFIG = {
    BASE_URL: `http://${window.location.hostname}:${API_PORT}/api`,
    WS_URL: `ws://${window.location.hostname}:${API_PORT}/api`,
    ENDPOINTS: {
        HEALTH: '/network/health',
        ANALYTICS: {
            SUMMARY: '/analytics/summary',
            HISTORY: '/network/history',
            PACKETS: '/analytics/packets',
            PREDICTION: '/analytics/prediction',
            ANOMALIES: '/analytics/anomalies',
            HISTORY_SYSTEM: '/analytics/history/system',
            HISTORY_DEVICE: (mac: string) => `/analytics/history/device/${mac}`,
            YEARLY: '/analytics/yearly',
        },
        SECURITY: {
            EVENTS: '/security/events',
            ALERTS: '/alerts',
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
            LOGS: '/network/dns',
            TOP: '/network/dns/top',
        },
        QUOTA: {
            BASE: '/quotas',
            BY_ID: (id: number) => `/quotas/${id}`,
        },
        AUTH: {
            LOGOUT: '/auth/logout',
            ME: '/auth/me',
        }
    }
} as const; // Add 'as const' to infer literal types correctly

export const getWsUrl = (path: string) => `${API_CONFIG.WS_URL}${path}`;
