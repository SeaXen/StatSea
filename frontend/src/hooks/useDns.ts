import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── DNS Logs ───
export const useDnsLogs = (limit: number = 50) => {
    return useQuery({
        queryKey: ['dns', 'logs', limit],
        queryFn: async () => {
            const { data } = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DNS.LOGS}?limit=${limit}`);
            return data;
        },
        refetchInterval: 5000,
    });
};

// ─── Top DNS Domains ───
export const useTopDomains = (limit: number = 5) => {
    return useQuery({
        queryKey: ['dns', 'top', limit],
        queryFn: async () => {
            const { data } = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DNS.TOP}?limit=${limit}`);
            return data;
        },
        refetchInterval: 5000,
    });
};
