import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

// ─── Container List ───
export const useContainers = () => {
    return useQuery({
        queryKey: ['docker', 'containers'],
        queryFn: async () => {
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.DOCKER.CONTAINERS);
            return Array.isArray(data) ? data : [];
        },
        refetchInterval: 3000,
    });
};

// ─── Container Logs ───
export const useContainerLogs = (containerId: string | null) => {
    return useQuery({
        queryKey: ['docker', 'logs', containerId],
        queryFn: async () => {
            if (!containerId) return [];
            const { data } = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DOCKER.LOGS(containerId)}?tail=100`);
            return data.logs || [];
        },
        enabled: !!containerId,
        refetchInterval: 5000,
    });
};

// ─── Container History ───
export const useContainerHistory = (containerId: string | null) => {
    return useQuery({
        queryKey: ['docker', 'history', containerId],
        queryFn: async () => {
            if (!containerId) return [];
            const { data } = await axiosInstance.get(`${API_CONFIG.ENDPOINTS.DOCKER.HISTORY(containerId)}?minutes=60`);
            return data || [];
        },
        enabled: !!containerId,
        refetchInterval: 10000,
    });
};

// ─── Container Usage ───
export const useContainerUsage = (containerId: string | null) => {
    return useQuery({
        queryKey: ['docker', 'usage', containerId],
        queryFn: async () => {
            if (!containerId) return null;
            const { data } = await axiosInstance.get(API_CONFIG.ENDPOINTS.DOCKER.USAGE(containerId));
            return data;
        },
        enabled: !!containerId,
        refetchInterval: 15000,
    });
};

// ─── Container Action Mutation ───
export const useContainerAction = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ containerId, action }: { containerId: string; action: string }) => {
            const { data } = await axiosInstance.post(
                `${API_CONFIG.ENDPOINTS.DOCKER.CONTAINERS}/${containerId}/action`,
                { action }
            );
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['docker', 'containers'] });
        },
    });
};

// ─── Docker Prune Mutation ───
export const useDockerPrune = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data } = await axiosInstance.post(API_CONFIG.ENDPOINTS.DOCKER.PRUNE);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['docker', 'containers'] });
        },
    });
};
