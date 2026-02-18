// Basic API Configuration
export const API_CONFIG = {
    BASE_URL: `http://${window.location.hostname}:21081/api`,
    WS_URL: `ws://${window.location.hostname}:21081/api`,
    ENDPOINTS: {
        HEALTH: '/network/health',
        ANALYTICS: {
            SUMMARY: '/analytics/summary',
            HISTORY: '/network/history',
        },
        SECURITY: {
            EVENTS: '/security/events',
        },
        NETWORK: {
            CONNECTIONS: '/network/connections',
        },
        DOCKER: {
            CONTAINERS: '/docker/containers',
            LOGS: (id: string) => `/docker/containers/${id}/logs`,
            HISTORY: (id: string) => `/docker/${id}/history`,
            USAGE: (id: string) => `/docker/${id}/usage`,
        },
        DEVICES: '/devices',
        SPEEDTEST: '/speedtest',
        SETTINGS: '/settings',
        SYSTEM: {
            INFO: '/system/info',
            PROCESSES: '/system/processes',
        },
    }
} as const; // Add 'as const' to infer literal types correctly

export const getWsUrl = (path: string) => `${API_CONFIG.WS_URL}${path}`;
