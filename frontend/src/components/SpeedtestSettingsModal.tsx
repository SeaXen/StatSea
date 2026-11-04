import React, { useState, useEffect } from 'react';
import { X, Save, MessageSquare, Bell, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../config/axiosInstance';
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
                    const response = await axiosInstance.get('/settings');
                    if (Array.isArray(response.data)) {
                        setSettings(prev => {
                            const newSettings = { ...prev };
                            response.data.forEach((s: { key: string; value: string }) => {
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
                axiosInstance.post('/settings', {
                    key,
                    value: String(value),
                    type: 'string', // Defaulting to string for simplicity
                    description: 'Speedtest Setting'
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
                    className="panel bg-panel border border-line rounded-[var(--r-panel)] w-full max-w-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 md:p-5 border-b border-line bg-raised">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent-soft rounded-lg text-accent">
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-text font-mono">Speedtest Automation</h2>
                                <p className="text-xs text-faint font-mono">Configure schedule and notifications</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-panel rounded-[7px] transition-colors text-faint hover:text-text">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 md:p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar font-mono text-xs">

                        {/* Schedule Section */}
                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Schedule
                            </h3>
                            <div className="bg-raised rounded-[var(--r-panel)] p-4 border border-line">
                                <label className="block text-xs font-medium text-text mb-2">
                                    Run Interval (Hours)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[0, 1, 6, 12, 24].map((interval) => (
                                        <button
                                            key={interval}
                                            onClick={() => handleChange('speedtest_interval', String(interval))}
                                            className={`px-3 py-1.5 rounded-[7px] text-xs font-medium transition-colors ${String(settings.speedtest_interval) === String(interval)
                                                ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
                                                : 'bg-panel text-faint hover:text-text border border-line'
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
                                        className="w-20 px-2.5 py-1.5 bg-panel border border-line rounded-[7px] text-text text-xs focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <p className="mt-2 text-[10px] text-faint">
                                    Set to 0 to disable automatic testing.
                                </p>
                            </div>
                        </section>

                        {/* Notifications Section */}
                        <section className="space-y-3">
                            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" /> Notifications
                            </h3>

                            {/* Telegram */}
                            <div className="bg-raised rounded-[var(--r-panel)] p-4 border border-line space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 rounded-full bg-[#229ED9]/20 flex items-center justify-center">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-text font-medium text-xs">Telegram</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-faint mb-1">Bot Token</label>
                                        <div className="relative">
                                            <Hash className="absolute left-2.5 top-2 w-3.5 h-3.5 text-faint" />
                                            <input
                                                type="password"
                                                value={settings.telegram_bot_token}
                                                onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-panel border border-line rounded-[7px] text-text text-xs focus:outline-none focus:border-accent"
                                                placeholder="123456:ABC-DEF..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-faint mb-1">Chat ID</label>
                                        <input
                                            type="text"
                                            value={settings.telegram_chat_id}
                                            onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-panel border border-line rounded-[7px] text-text text-xs focus:outline-none focus:border-accent"
                                            placeholder="-100123456789"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Discord */}
                            <div className="bg-raised rounded-[var(--r-panel)] p-4 border border-line space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                                        <img src="https://assets-global.website-files.com/6257adef93867e56f84d3092/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-text font-medium text-xs">Discord</span>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-faint mb-1">Webhook URL</label>
                                    <input
                                        type="password"
                                        value={settings.discord_webhook_url}
                                        onChange={(e) => handleChange('discord_webhook_url', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-panel border border-line rounded-[7px] text-text text-xs focus:outline-none focus:border-accent"
                                        placeholder="https://discord.com/api/webhooks/..."
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-line bg-raised flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-mono text-faint hover:text-text transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-accent-foreground rounded-[7px] font-mono text-xs font-medium hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <div className="w-3.5 h-3.5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Save Changes
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SpeedtestSettingsModal;
