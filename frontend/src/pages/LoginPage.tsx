import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('remember_me', String(rememberMe));

        try {
            const response = await axiosInstance.post('/auth/login', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { access_token, refresh_token } = response.data;
            await login(access_token, refresh_token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string } }; code?: string; message?: string };
            if (!axiosErr.response) {
                setError('Cannot connect to backend server. Please ensure the backend is running on port 8001.');
            } else {
                setError(axiosErr.response?.data?.detail || 'Invalid username or password');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 selection:bg-accent/20">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm"
            >
                <div className="panel p-6 border border-line-strong bg-panel rounded-[9px] shadow-2xl relative">
                    {/* Console Header */}
                    <div className="flex items-center justify-between border-b border-line pb-4 mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-[7px] bg-raised border border-line flex items-center justify-center text-accent">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <path d="M2 9c3-4 6-4 10 0s7 4 10 0" />
                                    <path d="M2 16c3-4 6-4 10 0s7 4 10 0" opacity=".5" />
                                </svg>
                            </div>
                            <div>
                                <div className="font-semibold text-sm tracking-tight text-text">StatSea Console</div>
                                <div className="text-[10px] font-mono text-faint">OPERATOR AUTHENTICATION</div>
                            </div>
                        </div>
                        <span className="status ok text-[9px] uppercase font-mono px-1.5 py-0.5">READY</span>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-3 font-mono text-xs">
                            {/* Username */}
                            <div className="space-y-1">
                                <label htmlFor="username" className="text-[11px] font-medium text-text-soft">
                                    Operator ID / Username
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                                        <User className="w-3.5 h-3.5" />
                                    </div>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-raised border border-line-strong rounded-[7px] py-2 pl-9 pr-3 text-xs text-text placeholder-faint focus:outline-none focus:border-accent transition-colors"
                                        placeholder="Enter your username"
                                        autoComplete="username"
                                        spellCheck={false}
                                        autoCapitalize="none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1">
                                <label htmlFor="password" className="text-[11px] font-medium text-text-soft">
                                    Access Key / Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                                        <Lock className="w-3.5 h-3.5" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-raised border border-line-strong rounded-[7px] py-2 pl-9 pr-3 text-xs text-text placeholder-faint focus:outline-none focus:border-accent transition-colors"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between font-mono text-[11px] pt-1">
                            <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-text transition-colors">
                                <input
                                    type="checkbox"
                                    name="remember_me"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="rounded-[3px] bg-raised border-line text-accent focus:ring-0 focus:ring-offset-0"
                                />
                                <span>Remember key</span>
                            </label>

                            <button
                                type="button"
                                className="text-accent hover:underline transition-colors"
                                onClick={() => toast.info("Please contact system administrator to reset password.")}
                            >
                                Forgot password?
                            </button>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    role="alert"
                                    aria-live="polite"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-2.5 bg-danger/10 border border-danger/30 rounded-[7px] flex items-center gap-2 text-danger text-[11px] font-mono"
                                >
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-[#0f1115] font-mono font-semibold text-xs tracking-wider uppercase py-2.5 rounded-[7px] flex items-center justify-center gap-2 transition-opacity"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-[#0f1115]" />
                            ) : (
                                <>
                                    AUTHENTICATE SESSION
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Console Footer */}
                    <div className="mt-5 pt-3 border-t border-line text-center">
                        <p className="text-[10px] font-mono text-faint">
                            StatSea Core Engine • v1.0 • Port 8001
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
