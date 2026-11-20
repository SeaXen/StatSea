/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../config/axiosInstance';

interface User {
    id: number;
    username: string;
    email: string;
    full_name: string | null;
    is_admin: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    login: (token: string, refreshToken: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    authError?: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('statsea_token'));
    const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('statsea_refresh_token'));
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const fetchUser = async () => {
        try {
            const response = await axiosInstance.get('/auth/me');
            setUser(response.data);
            setAuthError(null);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                // Only a real auth failure destroys the session — a transient
                // 5xx/network error must keep the token and stay retryable.
                setAuthError(null);
                logout();
            } else {
                setAuthError('Unable to verify your session. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const login = async (newToken: string, newRefreshToken: string) => {
        localStorage.setItem('statsea_token', newToken);
        localStorage.setItem('statsea_refresh_token', newRefreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        await fetchUser();
    };

    const logout = () => {
        // Revoke the server-side refresh token before clearing local state
        const rt = localStorage.getItem('statsea_refresh_token');
        if (rt) {
            axiosInstance.post('/auth/logout', { refresh_token: rt }).catch(() => {
                // Best-effort: if the server call fails, still clear local state
            });
        }
        localStorage.removeItem('statsea_token');
        localStorage.removeItem('statsea_refresh_token');
        setToken(null);
        setRefreshToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, refreshToken, login, logout, isLoading, authError }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
