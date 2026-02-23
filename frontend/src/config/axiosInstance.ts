import axios from 'axios';
import { toast } from 'sonner';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8001/api`,
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

// Response interceptor: Handle 401 Unauthorized with silent refresh and retry transient errors
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        // 1. Handle 401 Unauthorized
        if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('statsea_refresh_token');

            if (refreshToken) {
                try {
                    const response = await axios.post(`${axiosInstance.defaults.baseURL}/auth/refresh?refresh_token=${refreshToken}`);
                    const { access_token, refresh_token: newRefreshToken } = response.data;

                    localStorage.setItem('statsea_token', access_token);
                    localStorage.setItem('statsea_refresh_token', newRefreshToken);

                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return axiosInstance(originalRequest);
                } catch (refreshError) {
                    localStorage.removeItem('statsea_token');
                    localStorage.removeItem('statsea_refresh_token');
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                        toast.error('Session expired. Please login again.');
                    }
                    return Promise.reject(refreshError);
                }
            } else {
                localStorage.removeItem('statsea_token');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                    toast.error('Please login to continue.');
                }
            }
        }

        // 2. Retry Transient Errors (429, 502, 503, 504)
        const transientErrors = [429, 502, 503, 504];
        if (transientErrors.includes(status) && (!originalRequest._retryCount || originalRequest._retryCount < 2)) {
            originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
            const delay = originalRequest._retryCount * 1000;
            return new Promise(resolve => setTimeout(() => resolve(axiosInstance(originalRequest)), delay));
        }

        // 3. Global Error Toast (exclude expected/handled status codes)
        if (status && status >= 500) {
            toast.error('Server error. Please try again later.');
        } else if (error.code === 'ECONNABORTED' || !status) {
            toast.error('Network error. Check your connection.');
        } else if (status === 403) {
            toast.error('You do not have permission to perform this action.');
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
