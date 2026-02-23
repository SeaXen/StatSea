import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { AgentResponse } from '../types';

export const useAgents = () => {
    return useQuery({
        queryKey: ['agents'],
        queryFn: async () => {
            const { data } = await axiosInstance.get<AgentResponse[]>('/agents');
            return data;
        },
        refetchInterval: 5000, // Refresh every 5 seconds to get latest metrics
    });
};
