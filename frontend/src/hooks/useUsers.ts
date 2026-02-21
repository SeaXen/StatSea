import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';

// ─── Fetch Users ───
export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { data } = await axiosInstance.get('/admin/users');
            return data.items || data;
        },
        staleTime: 30000,
    });
};

// ─── Create User Mutation ───
export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userData: {
            username: string;
            email: string;
            full_name?: string;
            password: string;
            is_admin: boolean;
        }) => {
            const { data } = await axiosInstance.post('/admin/users', userData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};

// ─── Update User Mutation ───
export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, userData }: {
            userId: number;
            userData: {
                username?: string;
                email?: string;
                full_name?: string;
                is_admin?: boolean;
                is_active?: boolean;
                password?: string;
            };
        }) => {
            const { data } = await axiosInstance.put(`/admin/users/${userId}`, userData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};

// ─── Delete User Mutation ───
export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: number) => {
            const { data } = await axiosInstance.delete(`/admin/users/${userId}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};
