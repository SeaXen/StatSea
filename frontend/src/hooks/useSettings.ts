import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Fetch Settings ───
export const useSettings = () => {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.SETTINGS);
            const map: Record<string, string> = {};
            data.forEach((s: { key: string; value: string }) => {
                map[s.key] = s.value;
            });
            return map;
        },
        staleTime: 30000,
    });
};

// ─── Save Setting Mutation ───
export const useSaveSetting = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ key, value, type = 'string' }: { key: string; value: string; type?: string }) => {
            const { data } = await axiosInstance.post(API_CONFIG.ENDPOINTS.SETTINGS, { key, value, type });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
};

// ─── Change Password Mutation ───
export const useChangePassword = () => {
    return useMutation({
        mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
            const { data } = await axiosInstance.post('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });
            return data;
        },
    });
};
