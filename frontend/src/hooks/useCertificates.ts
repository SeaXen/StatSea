import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import { MonitoredCertificate, CertificateCreate, CertificateUpdate } from '../types';

export const useCertificates = () => {
    return useQuery<MonitoredCertificate[]>({
        queryKey: ['certificates'],
        queryFn: async () => {
            const response = await axios.get(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CERTIFICATES.BASE}`);
            return response.data;
        },
    });
};

export const useCreateCertificate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (cert: CertificateCreate) => {
            const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CERTIFICATES.BASE}`, cert);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['certificates'] });
        },
    });
};

export const useUpdateCertificate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: CertificateUpdate }) => {
            const response = await axios.patch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CERTIFICATES.BY_ID(id)}`,
                data
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['certificates'] });
        },
    });
};

export const useDeleteCertificate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const response = await axios.delete(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CERTIFICATES.BY_ID(id)}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['certificates'] });
        },
    });
};
