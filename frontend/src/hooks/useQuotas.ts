import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Fetch Quota for Device ───
export const useQuota = (deviceId: number) => {
    return useQuery({
        queryKey: ['quotas', deviceId],
        queryFn: async () => {
            const { data } = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.QUOTA.BASE}?device_id=${deviceId}`);
            return data;
        },
        staleTime: 30000,
    });
};

// ─── Save/Update Quota Mutation ───
export const useSaveQuota = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: {
            deviceId: number;
            daily_limit_bytes: number | null;
            monthly_limit_bytes: number | null;
            id?: number;
        }) => {
            const body = {
                device_id: payload.deviceId,
                daily_limit_bytes: payload.daily_limit_bytes,
                monthly_limit_bytes: payload.monthly_limit_bytes,
            };
            if (payload.id) {
                const { data } = await axiosInstance.put(
                    API_CONFIG.ENDPOINTS.QUOTA.BY_ID(payload.id),
                    body
                );
                return data;
            } else {
                const { data } = await axiosInstance.put(
                    API_CONFIG.ENDPOINTS.QUOTA.BY_ID(payload.deviceId),
                    body
                );
                return data;
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['quotas', variables.deviceId] });
        },
    });
};
