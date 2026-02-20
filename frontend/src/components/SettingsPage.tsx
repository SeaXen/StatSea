import { useState, useEffect } from 'react';
import { Save, Sun, Bell, Activity, Terminal, Database, Trash2, ShieldCheck, Cpu, User, Check, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../config/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { API_CONFIG } from '../config/apiConfig';
import { presets, accentColors, legacyThemes, ThemeConfig, ThemeMode } from '../lib/themes';

interface Setting {
    key: string;
    value: string;
    type: string;
    description?: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [activeSection, setActiveSection] = useState('appearance');
    const [devMode, setDevMode] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Password change state
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
        mode: 'dark',
        accent: accentColors[0].value
    });

    // Initial Load & Migration
    useEffect(() => {
        // 1. Dev Mode
        const savedDevMode = localStorage.getItem('devMode') === 'true';
        setDevMode(savedDevMode);

        // 2. Theme Migration & Loading
        const savedThemeConfig = localStorage.getItem('themeConfig');
        const legacyTheme = localStorage.getItem('theme');

        if (savedThemeConfig) {
            // New system exists, use it
            try {
                const parsed = JSON.parse(savedThemeConfig);
                setThemeConfig(parsed);
                applyTheme(parsed);
            } catch (e) {
                console.error("Failed to parse theme config", e);
                setDefaultTheme();
            }
        } else if (legacyTheme) {
            // Check if legacy theme matches a new preset name directly (e.g. 'cyberpunk')
            // or if it needs mapping
            if (presets[legacyTheme as ThemeMode]) {
                const newConfig: ThemeConfig = {
                    mode: legacyTheme as ThemeMode,
                    accent: presets[legacyTheme as ThemeMode].colors['--primary']
                };
                setThemeConfig(newConfig);
                applyTheme(newConfig);
                localStorage.setItem('themeConfig', JSON.stringify(newConfig));
                toast.info(`Theme restored: ${presets[legacyTheme as ThemeMode].name}`);
            } else if (legacyThemes[legacyTheme]) {
                // Map old mapped themes
                const migrated = legacyThemes[legacyTheme];
                setThemeConfig(migrated);
                applyTheme(migrated);
                localStorage.setItem('themeConfig', JSON.stringify(migrated));
                toast.info(`Theme migrated to new system`);
            } else {
                setDefaultTheme();
            }
        } else {
            setDefaultTheme();
        }

        fetchSettings();
    }, []);

    const setDefaultTheme = () => {
        const def = { mode: 'dark' as ThemeMode, accent: accentColors[0].value };
        setThemeConfig(def);
        applyTheme(def);
    };

    const fetchSettings = async () => {
        try {
            const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.SETTINGS);
            const settingsMap: Record<string, string> = {};
            res.data.forEach((s: Setting) => settingsMap[s.key] = s.value);
            setSettings(settingsMap);
        } catch (e) {
            console.error("Failed to fetch settings", e);
            toast.error("Failed to load backend settings");
        }
    };

    const saveSetting = async (key: string, value: string, type: string = 'string') => {
        try {
            await axiosInstance.post(API_CONFIG.ENDPOINTS.SETTINGS, { key, value, type });
            setSettings(prev => ({ ...prev, [key]: value }));
            toast.success("Setting saved");
        } catch (e) {
            toast.error("Failed to save setting");
        }
    };

    const updateTheme = (updates: Partial<ThemeConfig>) => {
        const newConfig = { ...themeConfig, ...updates };

        // If switching mode, reset accent to that mode's default primary IF it's one of the unique ones? 
        // No, let users keep their accent if they switched it. 
        // BUT if they switch to Cyberpunk, they probably want neon yellow, not blue.
        if (updates.mode) {
            const preset = presets[updates.mode];
            // Optional: Auto-switch accent to the preset's primary color for better default look
            newConfig.accent = preset.colors['--primary'];
        }

        setThemeConfig(newConfig);
        applyTheme(newConfig);
        localStorage.setItem('themeConfig', JSON.stringify(newConfig));
    };

    const applyTheme = (config: ThemeConfig) => {
        const root = document.documentElement;
        const base = presets[config.mode];

        if (!base) return;

        // Apply base theme variables
        Object.entries(base.colors).forEach(([key, value]) => {
            if (key !== '--accent' && key !== '--accent-foreground') {
                root.style.setProperty(key, value);
            }
        });

        // Apply accent color override
        // We override --primary and --ring with the chosen accent
        root.style.setProperty('--primary', config.accent);
        root.style.setProperty('--ring', config.accent);

        // Also update standard accent vars
        root.style.setProperty('--accent', config.accent);

        // Special handling for radius if Cyberpunk
        if (config.mode === 'cyberpunk') {
            root.style.setProperty('--radius', '0px');
        } else {
            root.style.setProperty('--radius', '0.5rem');
        }
    };

    const toggleDevMode = () => {
        const newMode = !devMode;
        setDevMode(newMode);
        localStorage.setItem('devMode', String(newMode));
        toast.info(`Developer Mode ${newMode ? 'Enabled' : 'Disabled'}`);
    };

    const clearLocalStorage = () => {
        if (confirm("Are you sure? This will reset all local preferences including theme.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await axiosInstance.get(API_CONFIG.ENDPOINTS.SETTINGS + '/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            // Content-Disposition header should provide filename, but fallback just in case
            const contentDisposition = res.headers['content-disposition'];
            let filename = 'statsea-backup.json';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2)
                    filename = filenameMatch[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Export completed successfully");
        } catch (e) {
            console.error("Export error:", e);
            toast.error("Failed to export data");
        } finally {
            setIsExporting(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setIsChangingPassword(true);
        try {
            await axiosInstance.post('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword
            });
            toast.success("Password changed successfully");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            const detail = error.response?.data?.detail || "Failed to change password";
            toast.error(detail);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const SidebarItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
        <button
            onClick={() => setActiveSection(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${activeSection === id
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
        >
            {activeSection === id && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary/5 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <Icon className={`w-5 h-5 relative z-10 transition-transform group-hover:scale-110 ${activeSection === id ? 'text-primary' : ''}`} />
            <span className="font-medium relative z-10">{label}</span>
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20 md:pb-0 pt-6 px-4 md:px-0">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-foreground tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Manage your preferences and system configuration
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 backdrop-blur-sm">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</span>
                    <button
                        onClick={toggleDevMode}
                        className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${devMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${devMode ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className={`text-xs font-bold ${devMode ? 'text-primary' : 'text-muted-foreground'}`}>DEV</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <nav className="space-y-2 sticky top-24 self-start">
                    <div className="md:hidden flex overflow-x-auto pb-4 gap-2 mb-4 scrollbar-hide">
                        {/* Mobile Horizontal Scroll */}
                        <SidebarItem id="account" icon={User} label="Account" />
                        <SidebarItem id="appearance" icon={Sun} label="Appearance" />
                        <SidebarItem id="monitoring" icon={Activity} label="Monitoring" />
                        <SidebarItem id="notifications" icon={Bell} label="Notifications" />
                        <SidebarItem id="backup" icon={Download} label="Backup" />
                    </div>

                    <div className="hidden md:block space-y-2">
                        <SidebarItem id="account" icon={User} label="Account" />
                        <SidebarItem id="appearance" icon={Sun} label="Appearance" />
                        <SidebarItem id="monitoring" icon={Activity} label="Monitoring" />
                        <SidebarItem id="notifications" icon={Bell} label="Notifications" />
                        <SidebarItem id="backup" icon={Download} label="Backup" />

                        {devMode && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="pt-4 mt-4 border-t border-border/10 space-y-2"
                            >
                                <div className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Developer
                                </div>
                                <SidebarItem id="developer" icon={Terminal} label="System Internals" />
                            </motion.div>
                        )}
                    </div>
                </nav>

                {/* Content Area */}
                <div className="md:col-span-3 min-h-[500px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Account Section */}
                            {activeSection === 'account' && (
                                <div className="space-y-6">
                                    <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                        <div className="flex items-center gap-6">
                                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                                <User className="w-10 h-10" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold">{user?.full_name || user?.username || 'User'}</h2>
                                                <p className="text-muted-foreground">{user?.email || 'No email provided'}</p>
                                                <div className="mt-2 text-xs font-mono bg-primary/5 text-primary px-2 py-1 rounded inline-block border border-primary/10">
                                                    ROLE: {user?.is_admin ? 'ADMINISTRATOR' : 'GENERAL USER'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-primary" />
                                            Security & Password
                                        </h3>

                                        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Current Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="w-full bg-card/50 border border-border/50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full bg-card/50 border border-border/50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full bg-card/50 border border-border/50 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                    placeholder="••••••••"
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isChangingPassword}
                                                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isChangingPassword ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Updating...
                                                    </>
                                                ) : (
                                                    'Update Password'
                                                )}
                                            </button>
                                        </form>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 pointer-events-none filter grayscale">
                                        <div className="p-6 rounded-2xl bg-card/20 border border-border/20">
                                            <h3 className="font-semibold mb-2">Sync Settings</h3>
                                            <p className="text-sm text-muted-foreground">Cloud sync coming soon</p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-card/20 border border-border/20">
                                            <h3 className="font-semibold mb-2">API Keys</h3>
                                            <p className="text-sm text-muted-foreground">Manage access tokens</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Appearance Section */}
                            {activeSection === 'appearance' && (
                                <div className="space-y-8">
                                    {/* Theme Presets */}
                                    <section>
                                        <h3 className="text-lg font-medium mb-4 px-1">Base Theme</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(presets).map(([key, theme]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => updateTheme({ mode: key as ThemeMode })}
                                                    className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 p-5 text-left h-28 hover:scale-[1.02] ${themeConfig.mode === key
                                                        ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10'
                                                        : 'border-border/40 hover:border-primary/30 hover:shadow-lg'
                                                        }`}
                                                    style={{ background: `hsl(${theme.colors['--background']})` }}
                                                >
                                                    <div className="flex items-center justify-between mb-3 relative z-10">
                                                        <span className="font-bold text-lg" style={{ color: `hsl(${theme.colors['--foreground']})` }}>
                                                            {theme.name}
                                                        </span>
                                                        {themeConfig.mode === key && (
                                                            <div className="bg-primary rounded-full p-1">
                                                                <Check className="w-3 h-3 text-primary-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Color swatches logic for the card */}
                                                    <div className="flex gap-2 relative z-10 opacity-80">
                                                        <div className="w-6 h-6 rounded-full shadow-sm ring-1 ring-white/10" style={{ background: `hsl(${theme.colors['--card']})` }} />
                                                        <div className="w-6 h-6 rounded-full shadow-sm ring-1 ring-white/10" style={{ background: `hsl(${theme.colors['--primary']})` }} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Accent Color Selection */}
                                    <section>
                                        <h3 className="text-lg font-medium mb-4 px-1">Accent Color</h3>
                                        <div className="p-6 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                            <div className="flex flex-wrap gap-4">
                                                {accentColors.map((color) => (
                                                    <button
                                                        key={color.name}
                                                        onClick={() => updateTheme({ accent: color.value })}
                                                        className={`w-12 h-12 rounded-full relative transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-background ${themeConfig.accent === color.value ? 'ring-2 ring-foreground scale-110' : ''}`}
                                                        style={{ backgroundColor: color.hex }}
                                                        title={color.name}
                                                    >
                                                        {themeConfig.accent === color.value && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <Check className="w-6 h-6 text-white drop-shadow-md" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-border/10 flex items-center gap-2">
                                                <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                                                    <div className="h-full bg-primary transition-all duration-300 w-2/3" />
                                                </div>
                                                <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">Preview</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Monitoring Section */}
                            {activeSection === 'monitoring' && (
                                <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                                            <Activity className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold">Monitoring Intervals</h2>
                                            <p className="text-muted-foreground">Configure how frequently Statsea gathers data</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="group space-y-3">
                                            <label className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">Ping Interval (seconds)</label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="number"
                                                    className="bg-card/50 border border-border/50 rounded-xl px-5 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                                                    value={settings['ping_interval'] || '5'}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, ping_interval: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveSetting('ping_interval', settings['ping_interval'] || '5', 'int')}
                                                    className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                                                >
                                                    <Save className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-1">Frequency of latency checks to Google DNS and Gateway.</p>
                                        </div>

                                        <div className="h-px bg-border/20" />

                                        <div className="group space-y-3">
                                            <label className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">Speedtest Interval (minutes)</label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="number"
                                                    className="bg-card/50 border border-border/50 rounded-xl px-5 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                                                    value={settings['speedtest_interval'] || '180'}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, speedtest_interval: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveSetting('speedtest_interval', settings['speedtest_interval'] || '180', 'int')}
                                                    className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                                                >
                                                    <Save className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-1">Automatic Internet speed check interval. Set to 0 to disable.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notifications Section */}
                            {activeSection === 'notifications' && (
                                <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                                            <Bell className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold">Alert Integrations</h2>
                                            <p className="text-muted-foreground">Receive real-time notifications where you need them</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                                Discord Webhook
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    placeholder="https://discord.com/api/webhooks/..."
                                                    className="bg-card/50 border border-border/50 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                                    value={settings['DISCORD_WEBHOOK_URL'] || ''}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, DISCORD_WEBHOOK_URL: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveSetting('DISCORD_WEBHOOK_URL', settings['DISCORD_WEBHOOK_URL'] || '', 'string')}
                                                    className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-500 transition-colors"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                <div className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                                                Telegram Configuration
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="relative">
                                                    <input
                                                        type="password"
                                                        placeholder="Bot Token"
                                                        className="bg-card/50 border border-border/50 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                                                        value={settings['TELEGRAM_BOT_TOKEN'] || ''}
                                                        onChange={(e) => setSettings(prev => ({ ...prev, TELEGRAM_BOT_TOKEN: e.target.value }))}
                                                    />
                                                    <button
                                                        onClick={() => saveSetting('TELEGRAM_BOT_TOKEN', settings['TELEGRAM_BOT_TOKEN'] || '', 'string')}
                                                        className="absolute right-2 top-2 bottom-2 bg-sky-600 text-white px-3 rounded-lg hover:bg-sky-500 transition-colors"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Chat ID"
                                                        className="bg-card/50 border border-border/50 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                                                        value={settings['TELEGRAM_CHAT_ID'] || ''}
                                                        onChange={(e) => setSettings(prev => ({ ...prev, TELEGRAM_CHAT_ID: e.target.value }))}
                                                    />
                                                    <button
                                                        onClick={() => saveSetting('TELEGRAM_CHAT_ID', settings['TELEGRAM_CHAT_ID'] || '', 'string')}
                                                        className="absolute right-2 top-2 bottom-2 bg-sky-600 text-white px-3 rounded-lg hover:bg-sky-500 transition-colors"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Backup Section */}
                            {activeSection === 'backup' && (
                                <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                                            <Download className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold">Data Management</h2>
                                            <p className="text-muted-foreground">Export your system data for backup or analysis</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-6 rounded-2xl bg-card/20 border border-border/20">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-lg font-medium mb-1">Export Database</h3>
                                                    <p className="text-sm text-muted-foreground max-w-md">
                                                        Download a complete JSON backup of all devices, traffic logs, speedtest results, and system configuration.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleExport}
                                                    disabled={isExporting}
                                                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none"
                                                >
                                                    {isExporting ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            Exporting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-5 h-5" />
                                                            Export Data
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-3">
                                            <Database className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-yellow-200/80">
                                                Note: Importing data is not yet supported in this version. Keep your backups safe.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Developer Section */}
                            {activeSection === 'developer' && (
                                <div className="space-y-6">
                                    <div className="p-8 rounded-3xl border border-red-500/20 bg-red-900/5 backdrop-blur-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-32 bg-red-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400">
                                                <Terminal className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-semibold">System Internals</h2>
                                                <p className="text-muted-foreground">Advanced controls for debugging and development</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Database className="w-5 h-5 text-yellow-400" />
                                                        <span className="font-medium">Local Storage</span>
                                                    </div>
                                                    <button
                                                        onClick={clearLocalStorage}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <div className="mb-2">
                                                    <p className="text-xs text-muted-foreground mb-1">
                                                        Current Theme Config:
                                                    </p>
                                                    <pre className="text-[10px] bg-black/50 p-2 rounded border border-white/5 overflow-x-auto text-green-400/80">
                                                        {JSON.stringify(themeConfig, null, 2)}
                                                    </pre>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Clear all client-side persistence including themes, auth tokens, and cached states.
                                                </p>
                                            </div>

                                            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <ShieldCheck className="w-5 h-5 text-green-400" />
                                                        <span className="font-medium">Environment</span>
                                                    </div>
                                                    <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">PROD</span>
                                                </div>
                                                <div className="space-y-2 text-xs font-mono text-muted-foreground">
                                                    <div className="flex justify-between">
                                                        <span>API Base:</span>
                                                        <span className="text-foreground">{API_CONFIG.BASE_URL}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>WS Endpoint:</span>
                                                        <span className="text-foreground">{API_CONFIG.WS_URL}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 col-span-1 md:col-span-2">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <Cpu className="w-5 h-5 text-blue-400" />
                                                    <span className="font-medium">Client Info</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                                    <div className="p-3 rounded-lg bg-white/5">
                                                        <span className="text-muted-foreground block mb-1">User Agent</span>
                                                        <span className="text-foreground break-all">{navigator.userAgent}</span>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-white/5">
                                                        <span className="text-muted-foreground block mb-1">Resolution</span>
                                                        <span className="text-foreground">{window.innerWidth}x{window.innerHeight}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
