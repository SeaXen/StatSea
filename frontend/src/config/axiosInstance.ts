import axios from 'axios';
import { toast } from 'sonner';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: Attach JWT token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('statsea_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 Unauthorized
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear token and redirect to login
            localStorage.removeItem('statsea_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
                toast.error('Session expired. Please login again.');
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
