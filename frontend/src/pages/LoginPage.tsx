import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
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
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl mb-4 border border-blue-500/20">
                            <Shield className="w-8 h-8 text-blue-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">StatSea</h1>
                        <p className="text-slate-400">Secure Network Intelligence Dashboard</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            {/* Username */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                        placeholder="Enter your username"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-5 h-5 bg-slate-950/50 border border-slate-800 rounded-md peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                        <Shield className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
                            </label>

                            <button
                                type="button"
                                className="text-sm text-blue-500 hover:text-blue-400 transition-colors font-medium"
                                onClick={() => toast.info("Please contact your administrator to reset password.")}
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-500 text-sm"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
                        <p className="text-slate-500 text-xs">
                            Access restricted to authorized personnel only.
                            <br />All activity is being monitored and logged.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
