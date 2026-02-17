import { useState, useEffect } from 'react';
import { Save, Sun, Bell, Activity, CheckCircle2, Terminal, Database, Trash2, ShieldCheck, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { themes } from '../lib/themes';

interface Setting {
    key: string;
    value: string;
    type: string;
    description?: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [activeSection, setActiveSection] = useState('appearance');
    const [currentTheme, setCurrentTheme] = useState('default');
    const [devMode, setDevMode] = useState(false);

    // Load initial theme and dev mode from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'default';
        setCurrentTheme(savedTheme);
        applyTheme(savedTheme);

        const savedDevMode = localStorage.getItem('devMode') === 'true';
        setDevMode(savedDevMode);
    }, []);

    // Fetch backend settings
    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`http://${window.location.hostname}:21081/api/settings`);
            if (res.ok) {
                const data: Setting[] = await res.json();
                const settingsMap: Record<string, string> = {};
                data.forEach(s => settingsMap[s.key] = s.value);
                setSettings(settingsMap);
            }
        } catch (e) {
            console.error("Failed to fetch settings", e);
            toast.error("Failed to load settings");
        }
    };

    const saveSetting = async (key: string, value: string, type: string = 'string') => {
        try {
            const res = await fetch(`http://${window.location.hostname}:21081/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, type })
            });
            if (res.ok) {
                setSettings(prev => ({ ...prev, [key]: value }));
                toast.success("Setting saved");
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            toast.error("Failed to save setting");
        }
    };

    const applyTheme = (themeKey: string) => {
        const theme = themes[themeKey];
        if (!theme) return;

        const root = document.documentElement;
        Object.entries(theme.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        localStorage.setItem('theme', themeKey);
        setCurrentTheme(themeKey);
        toast.success(`Theme changed to ${theme.name}`);
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
        <div className="max-w-6xl mx-auto pb-20 md:pb-0 pt-6">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-foreground tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        Customize your Statsea experience
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</span>
                    <button
                        onClick={toggleDevMode}
                        className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${devMode ? 'bg-primary' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${devMode ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className={`text-xs font-bold ${devMode ? 'text-primary' : 'text-gray-500'}`}>DEV</span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <nav className="space-y-2 sticky top-24 self-start">
                    <SidebarItem id="appearance" icon={Sun} label="Appearance" />
                    <SidebarItem id="monitoring" icon={Activity} label="Monitoring" />
                    <SidebarItem id="notifications" icon={Bell} label="Notifications" />

                    {devMode && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-4 mt-4 border-t border-white/5 space-y-2"
                        >
                            <div className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Developer
                            </div>
                            <SidebarItem id="developer" icon={Terminal} label="System Internals" />
                        </motion.div>
                    )}
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
                            {/* Appearance Section */}
                            {activeSection === 'appearance' && (
                                <div className="space-y-6">
                                    <div className="glass-card p-8 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl">
                                        <h2 className="text-2xl font-semibold mb-6">Theme Gallery</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {Object.entries(themes).map(([key, theme]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => applyTheme(key)}
                                                    className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 p-5 text-left h-32 hover:scale-[1.02] ${currentTheme === key
                                                            ? 'border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/20'
                                                            : 'border-white/5 hover:border-primary/50 hover:shadow-lg'
                                                        }`}
                                                    style={{ background: `hsl(${theme.colors['--card']})` }}
                                                >
                                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                                        <span className="font-bold text-lg" style={{ color: `hsl(${theme.colors['--foreground']})` }}>
                                                            {theme.name}
                                                        </span>
                                                        {currentTheme === key && (
                                                            <div className="bg-primary rounded-full p-1">
                                                                <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 relative z-10">
                                                        {[
                                                            theme.colors['--background'],
                                                            theme.colors['--primary'],
                                                            theme.colors['--secondary'],
                                                            theme.colors['--accent']
                                                        ].map((color, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-8 h-8 rounded-full shadow-sm ring-1 ring-white/10"
                                                                style={{ background: `hsl(${color})` }}
                                                            />
                                                        ))}
                                                    </div>
                                                    {/* Background Glow Effect */}
                                                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Monitoring Section */}
                            {activeSection === 'monitoring' && (
                                <div className="glass-card p-8 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl">
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
                                                    className="bg-black/40 border border-white/10 rounded-xl px-5 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
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

                                        <div className="h-px bg-white/5" />

                                        <div className="group space-y-3">
                                            <label className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">Speedtest Interval (minutes)</label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="number"
                                                    className="bg-black/40 border border-white/10 rounded-xl px-5 py-3 w-full focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
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
                                <div className="glass-card p-8 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-xl">
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
                                                    className="bg-black/40 border border-white/10 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
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
                                                        className="bg-black/40 border border-white/10 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
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
                                                        className="bg-black/40 border border-white/10 rounded-xl pl-5 pr-14 py-3 w-full focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
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

                            {/* Developer Section */}
                            {activeSection === 'developer' && (
                                <div className="space-y-6">
                                    <div className="glass-card p-8 rounded-3xl border border-red-500/20 bg-red-900/5 backdrop-blur-xl relative overflow-hidden">
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
                                                <p className="text-xs text-muted-foreground">
                                                    Clear all client-sider persistance including themes, auth tokens, and cached states.
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
                                                        <span className="text-foreground">{window.location.hostname}:21081</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>WS Endpoint:</span>
                                                        <span className="text-foreground">wss://{window.location.hostname}:21081</span>
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
