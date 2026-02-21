import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── System Info ───
export const useSystemInfo = () => {
    return useQuery({
        queryKey: ['system', 'info'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.SYSTEM.INFO);
            return data;
        },
        refetchInterval: 5000,
    });
};

// ─── Health Status ───
export const useHealth = () => {
    return useQuery({
        queryKey: ['health'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH);
            return {
                score: data.score ?? (data.status === 'healthy' ? 100 : 0),
                status: data.status || 'Excellent',
            };
        },
        refetchInterval: 5000,
    });
};

// ─── System Processes ───
export const useProcesses = () => {
    return useQuery({
        queryKey: ['system', 'processes'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.SYSTEM.PROCESSES);
            return data;
        },
        refetchInterval: 10000,
    });
};
