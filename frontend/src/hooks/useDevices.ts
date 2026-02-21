import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

export const useDevices = () => {
    return useQuery({
        queryKey: ['devices'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.DEVICES.LIST);
            return data.items || data;
        },
    });
};

export const useDeviceGroups = () => {
    return useQuery({
        queryKey: ['deviceGroups'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.DEVICES.GROUPS);
            return data.items || data;
        },
    });
};

export const useWakeDevice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (mac: string) => {
            const { data } = await axiosInstance.post(API_CONFIG.ENDPOINTS.DEVICES.WAKE(mac));
            return data;
        },
        onSuccess: () => {
            // Invalidate or update relevant queries if needed
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
};

export const useAddGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; color: string }) => {
            const res = await axiosInstance.post(API_CONFIG.ENDPOINTS.DEVICES.GROUPS, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
        },
    });
};

export const useUpdateGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { id: number; name: string; color: string }) => {
            const res = await axiosInstance.put(`${API_CONFIG.ENDPOINTS.DEVICES.GROUPS}/${data.id}`, {
                name: data.name,
                color: data.color
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
        },
    });
};

export const useDeleteGroup = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const res = await axiosInstance.delete(`${API_CONFIG.ENDPOINTS.DEVICES.GROUPS}/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deviceGroups'] });
            queryClient.invalidateQueries({ queryKey: ['devices'] }); // Invalidate devices too since they might point to the deleted group
        },
    });
};

