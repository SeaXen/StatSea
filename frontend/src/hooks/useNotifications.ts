import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';
import { NotificationChannel, NotificationChannelCreate, NotificationChannelUpdate } from '../types';

export const useNotificationChannels = () => {
    return useQuery<NotificationChannel[]>({
        queryKey: ['notification-channels'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.NOTIFICATIONS.CHANNELS);
            return data;
        },
    });
};

export const useCreateNotificationChannel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (channel: NotificationChannelCreate) => {
            // Ensure type is correct
            const { data } = await axiosInstance.post(API_CONFIG.ENDPOINTS.NOTIFICATIONS.CHANNELS, channel);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
        },
    });
};

export const useUpdateNotificationChannel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: NotificationChannelUpdate }) => {
            const res = await axiosInstance.put(API_CONFIG.ENDPOINTS.NOTIFICATIONS.CHANNEL_BY_ID(id), data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
        },
    });
};

export const useDeleteNotificationChannel = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await axiosInstance.delete(API_CONFIG.ENDPOINTS.NOTIFICATIONS.CHANNEL_BY_ID(id));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
        },
    });
};

export const useTestNotificationChannel = () => {
    return useMutation({
        mutationFn: async (id: number) => {
            await axiosInstance.post(API_CONFIG.ENDPOINTS.NOTIFICATIONS.TEST_CHANNEL(id));
        }
    });
};
