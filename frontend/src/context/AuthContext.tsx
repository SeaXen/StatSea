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
    login: (token: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('statsea_token'));
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

    const login = async (newToken: string) => {
        localStorage.setItem('statsea_token', newToken);
        setToken(newToken);
        // We don't await fetchUser here because useEffect will trigger it 
        // once token state changes, but for immediate UI response:
        await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('statsea_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
