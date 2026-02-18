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

// Response interceptor: Handle 401 Unauthorized with silent refresh
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('statsea_refresh_token');

            if (refreshToken) {
                try {
                    // Attempt to get new access token
                    const response = await axios.post(`${axiosInstance.defaults.baseURL}/auth/refresh?refresh_token=${refreshToken}`);
                    const { access_token, refresh_token: newRefreshToken } = response.data;

                    // Update localStorage
                    localStorage.setItem('statsea_token', access_token);
                    localStorage.setItem('statsea_refresh_token', newRefreshToken);

                    // Update header and retry
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    // Refresh failed, logout
                    localStorage.removeItem('statsea_token');
                    localStorage.removeItem('statsea_refresh_token');
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                        toast.error('Session expired. Please login again.');
                    }
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token, redirect to login
                localStorage.removeItem('statsea_token');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                    toast.error('Please login to continue.');
                }
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
