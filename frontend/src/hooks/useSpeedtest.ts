import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Speedtest History ───
export const useSpeedtestHistory = () => {
    return useQuery({
        queryKey: ['speedtest', 'history'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.SPEEDTEST);
            return data;
        },
        staleTime: 30000,
    });
};

// ─── Run Speedtest Mutation ───
export const useRunSpeedtest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (provider: 'ookla' | 'cloudflare') => {
            const { data } = await axiosInstance.post(
                `${API_CONFIG.ENDPOINTS.SPEEDTEST}?provider=${provider}`
            );
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['speedtest', 'history'] });
        },
    });
};
