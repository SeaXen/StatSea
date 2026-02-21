import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Security Alerts ───
export const useSecurityAlerts = (params?: { severity?: string; timeframe?: string }) => {
    return useQuery({
        queryKey: ['security', 'alerts', params?.severity, params?.timeframe],
        queryFn: async () => {
            const urlParams = new URLSearchParams();
            if (params?.severity && params.severity !== 'all') {
                urlParams.append('severity', params.severity);
            }
            if (params?.timeframe && params.timeframe !== '24h') {
                urlParams.append('timeframe', params.timeframe);
            }
            const { data } = await axiosInstance.get(
                `${API_CONFIG.ENDPOINTS.SECURITY.ALERTS}?${urlParams.toString()}`
            );
            return data.items || data;
        },
        refetchInterval: 30000,
    });
};

// ─── Resolve Alert Mutation ───
export const useResolveAlert = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (alertId: number) => {
            const { data } = await axiosInstance.patch(API_CONFIG.ENDPOINTS.SECURITY.RESOLVE(alertId));
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security', 'alerts'] });
        },
    });
};
