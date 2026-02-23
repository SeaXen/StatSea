import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Analytics Summary ───
export const useAnalyticsSummary = () => {
    return useQuery({
        queryKey: ['analytics', 'summary'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.SUMMARY);
            return data;
        },
        refetchInterval: 5000,
    });
};

// ─── Network History ───
export const useNetworkHistory = (limit?: number) => {
    return useQuery({
        queryKey: ['analytics', 'history', limit],
        queryFn: async () => {
            const url = limit
                ? `${API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY}?limit=${limit}`
                : API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY;
            const { data } = await axiosInstance.get(url);
            return data;
        },
        refetchInterval: 5000,
    });
};

// ─── Security Events ───
export const useSecurityEvents = () => {
    return useQuery({
        queryKey: ['security', 'events'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.SECURITY.EVENTS);
            return data;
        },
        refetchInterval: 10000,
    });
};

// ─── External Connections ───
export const useExternalConnections = () => {
    return useQuery({
        queryKey: ['network', 'connections'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.NETWORK.CONNECTIONS);
            return data;
        },
        refetchInterval: 5000,
    });
};

// ─── Packet Logs ───
export const usePacketLogs = (params?: { searchQuery?: string; flagFilter?: string }) => {
    return useQuery({
        queryKey: ['analytics', 'packets', params?.searchQuery, params?.flagFilter],
        queryFn: async () => {
            const urlParams = new URLSearchParams();
            urlParams.append('limit', '100');

            if (params?.searchQuery) {
                const q = params.searchQuery.trim();
                if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(q)) {
                    urlParams.append('ip', q);
                } else if (/^\d+$/.test(q)) {
                    urlParams.append('port', q);
                } else {
                    urlParams.append('protocol', q);
                }
            }

            if (params?.flagFilter) {
                urlParams.append('flags', params.flagFilter);
            }

            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.PACKETS, { params: urlParams });
            return data;
        },
        refetchInterval: 3000,
    });
};

// ─── Predictions & Anomalies ───
export const usePrediction = () => {
    return useQuery({
        queryKey: ['analytics', 'prediction'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.PREDICTION);
            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useAnomalies = () => {
    return useQuery({
        queryKey: ['analytics', 'anomalies'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.ANOMALIES);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
};

// ─── Yearly Stats ───
export const useYearlyStats = () => {
    return useQuery({
        queryKey: ['analytics', 'yearly'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.ANALYTICS.YEARLY);
            return data;
        },
        staleTime: 60 * 1000,
    });
};

// ─── System History ───
export const useSystemHistory = (params?: {
    days?: number;
    period?: string;
    start?: string;
    end?: string;
}) => {
    return useQuery({
        queryKey: ['analytics', 'history', 'system', params],
        queryFn: async () => {
            const urlParams = new URLSearchParams();
            if (params?.days) urlParams.append('days', String(params.days));
            if (params?.period) urlParams.append('period', params.period);
            if (params?.start) urlParams.append('start', params.start);
            if (params?.end) urlParams.append('end', params.end);

            const qs = urlParams.toString();
            const url = qs
                ? `${API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY_SYSTEM}?${qs}`
                : API_CONFIG.ENDPOINTS.ANALYTICS.HISTORY_SYSTEM;
            const { data } = await axiosInstance.get(url);
            return data;
        },
        staleTime: 30000,
    });
};

// ─── Traffic Categories ───
export const useTrafficCategories = (deviceId?: number) => {
    return useQuery({
        queryKey: ['analytics', 'traffic-categories', deviceId],
        queryFn: async () => {
            const url = deviceId
                ? `${API_CONFIG.ENDPOINTS.ANALYTICS.TRAFFIC_CATEGORIES}?device_id=${deviceId}`
                : API_CONFIG.ENDPOINTS.ANALYTICS.TRAFFIC_CATEGORIES;
            const { data } = await axiosInstance.get(url);
            return data;
        },
        refetchInterval: 5000,
    });
};
