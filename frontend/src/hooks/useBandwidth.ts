import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

const fetchers = {
    getInterfaces: async () => {
        const { data } = await axiosInstance.get<string[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.INTERFACES}`);
        return data;
    },
    getSummary: async () => {
        const { data } = await axiosInstance.get<Record<string, any>>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.SUMMARY}`);
        return data;
    },
    getFiveMinute: async (iface: string, hours: number = 24) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.FIVEMINUTE}`, {
            params: { interface: iface, hours }
        });
        return data;
    },
    getHourly: async (iface: string, date: string) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.HOURLY}`, {
            params: { interface: iface, date }
        });
        return data;
    },
    getDaily: async (iface: string, days: number = 30) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.DAILY}`, {
            params: { interface: iface, days }
        });
        return data;
    },
    getMonthly: async (iface: string) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.MONTHLY}`, {
            params: { interface: iface }
        });
        return data;
    },
    getYearly: async (iface: string) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.YEARLY}`, {
            params: { interface: iface }
        });
        return data;
    },
    getTop: async (iface: string, limit: number = 10) => {
        const { data } = await axiosInstance.get<any[]>(`${API_CONFIG.ENDPOINTS.BANDWIDTH.TOP}`, {
            params: { interface: iface, limit }
        });
        return data;
    },
};

export const useInterfaces = () => {
    return useQuery({
        queryKey: ['bandwidth', 'interfaces'],
        queryFn: fetchers.getInterfaces,
        staleTime: 5 * 60 * 1000,
    });
};

export const useBandwidthSummary = () => {
    return useQuery({
        queryKey: ['bandwidth', 'summary'],
        queryFn: () => fetchers.getSummary(),
        refetchInterval: 60000,
    });
};

export const useBandwidthFiveMinute = (iface: string, hours: number = 24) => {
    return useQuery({
        queryKey: ['bandwidth', 'fiveminute', iface, hours],
        queryFn: () => fetchers.getFiveMinute(iface, hours),
        enabled: !!iface,
        refetchInterval: 5 * 60 * 1000,
    });
};

export const useBandwidthHourly = (iface: string, date: string) => {
    return useQuery({
        queryKey: ['bandwidth', 'hourly', iface, date],
        queryFn: () => fetchers.getHourly(iface, date),
        enabled: !!iface && !!date,
        refetchInterval: date === new Date().toISOString().split('T')[0] ? 60000 : false,
    });
};

export const useBandwidthDaily = (iface: string, days: number = 30) => {
    return useQuery({
        queryKey: ['bandwidth', 'daily', iface, days],
        queryFn: () => fetchers.getDaily(iface, days),
        enabled: !!iface,
        refetchInterval: 60 * 60 * 1000,
    });
};

export const useBandwidthMonthly = (iface: string) => {
    return useQuery({
        queryKey: ['bandwidth', 'monthly', iface],
        queryFn: () => fetchers.getMonthly(iface),
        enabled: !!iface,
        refetchInterval: 60 * 60 * 1000,
    });
};

export const useBandwidthYearly = (iface: string) => {
    return useQuery({
        queryKey: ['bandwidth', 'yearly', iface],
        queryFn: () => fetchers.getYearly(iface),
        enabled: !!iface,
        refetchInterval: 60 * 60 * 1000,
    });
};

export const useBandwidthTop = (iface: string, limit: number = 10) => {
    return useQuery({
        queryKey: ['bandwidth', 'top', iface, limit],
        queryFn: () => fetchers.getTop(iface, limit),
        enabled: !!iface,
        refetchInterval: 60 * 60 * 1000,
    });
};
