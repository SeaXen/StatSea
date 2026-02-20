import React, { useState, useEffect } from 'react';
import { X, Save, MessageSquare, Bell, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { API_CONFIG } from '../config/apiConfig';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeedtestSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SpeedtestSettingsModal: React.FC<SpeedtestSettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState({
        speedtest_interval: "0",
        telegram_bot_token: "",
        telegram_chat_id: "",
        discord_webhook_url: "",
        speedtest_provider: "ookla",
        speedtest_server_id: "0"
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadSettings = async () => {
                try {
                    const response = await fetch(`${API_CONFIG.BASE_URL}/api/settings`);
                    if (response.ok) {
                        const data = await response.json();
                        setSettings(prev => {
                            const newSettings = { ...prev };
                            data.forEach((s: { key: string; value: string }) => {
                                if (Object.prototype.hasOwnProperty.call(newSettings, s.key)) {
                                    (newSettings as Record<string, string>)[s.key] = s.value;
                                }
                            });
                            return newSettings;
                        });
                    }
                } catch {
                    toast.error("Failed to load settings");
                }
            };
            loadSettings();
        }
    }, [isOpen]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save each setting
            const promises = Object.entries(settings).map(([key, value]) =>
                fetch(`${API_CONFIG.BASE_URL}/api/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key,
                        value: String(value),
                        type: 'string', // Defaulting to string for simplicity
                        description: 'Speedtest Setting'
                    })
                })
            );

            await Promise.all(promises);
            toast.success("Settings saved successfully");
            onClose();
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Bell className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">Speedtest Automation</h2>
                                <p className="text-sm text-slate-400">Configure schedule and notifications</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">

                        {/* Schedule Section */}
                        <section className="space-y-4">
                            <h3 className="text-sm font-medium text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Schedule
                            </h3>
                            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Run Interval (Hours)
                                </label>
                                <div className="flex gap-3">
                                    {[0, 1, 6, 12, 24].map((interval) => (
                                        <button
                                            key={interval}
                                            onClick={() => handleChange('speedtest_interval', String(interval))}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${String(settings.speedtest_interval) === String(interval)
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                }`}
                                        >
                                            {interval === 0 ? 'Disabled' : `${interval}h`}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        placeholder="Custom"
                                        value={settings.speedtest_interval}
                                        onChange={(e) => handleChange('speedtest_interval', e.target.value)}
                                        className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    Set to 0 to disable automatic testing.
                                </p>
                            </div>
                        </section>

                        {/* Notifications Section */}
                        <section className="space-y-4">
                            <h3 className="text-sm font-medium text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Notifications
                            </h3>

                            {/* Telegram */}
                            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-[#229ED9]/20 flex items-center justify-center">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" className="w-4 h-4" />
                                    </div>
                                    <span className="text-slate-200 font-medium">Telegram</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Bot Token</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                            <input
                                                type="password"
                                                value={settings.telegram_bot_token}
                                                onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:border-[#229ED9] transition-colors"
                                                placeholder="123456:ABC-DEF..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Chat ID</label>
                                        <input
                                            type="text"
                                            value={settings.telegram_chat_id}
                                            onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                                            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:border-[#229ED9] transition-colors"
                                            placeholder="-100123456789"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Discord */}
                            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                                        <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="w-4 h-4" />
                                    </div>
                                    <span className="text-slate-200 font-medium">Discord</span>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Webhook URL</label>
                                    <input
                                        type="password"
                                        value={settings.discord_webhook_url}
                                        onChange={(e) => handleChange('discord_webhook_url', e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:border-[#5865F2] transition-colors"
                                        placeholder="https://discord.com/api/webhooks/..."
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-700/50 bg-slate-900/50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SpeedtestSettingsModal;
