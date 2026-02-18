import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../config/axiosInstance';
import { API_CONFIG } from '../config/apiConfig';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('statsea_token'));
    const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('statsea_refresh_token'));
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const response = await axiosInstance.get('/auth/me');
            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            // logout() is called by axiosInstance on 401, 
            // but we call it here to ensure local state is cleared too
            logout();
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
    }, [token]);

    const login = async (newToken: string, newRefreshToken: string) => {
        localStorage.setItem('statsea_token', newToken);
        localStorage.setItem('statsea_refresh_token', newRefreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('statsea_token');
        localStorage.removeItem('statsea_refresh_token');
        setToken(null);
        setRefreshToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, refreshToken, login, logout, isLoading }}>
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
