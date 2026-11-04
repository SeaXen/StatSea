import { useState, useEffect } from 'react';
import { Save, Sun, Bell, Activity, Terminal, Database, Trash2, ShieldCheck, Cpu, User, Check, Download, Loader2, ClipboardList, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import axiosInstance from '../config/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_CONFIG } from '../config/apiConfig';
import { presets, accentColors, ThemeMode } from '../lib/themes';
import { useSettings as useSettingsQuery, useSaveSetting, useChangePassword } from '../hooks/useSettings';
import AuditLogTab from './AuditLogTab';
import ReportSettings from './ReportSettings';
import NotificationSettings from './NotificationSettings';
import { CertMonitor } from './CertMonitor';
import { cn } from '../lib/utils';

export default function Settings() {
    const { data: fetchedSettings = {} } = useSettingsQuery();
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [activeSection, setActiveSection] = useState('appearance');
    const [devMode, setDevMode] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Password change state
    const { user } = useAuth();
    const { themeConfig, updateTheme } = useTheme();
    const saveSettingMutation = useSaveSetting();
    const changePasswordMutation = useChangePassword();

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Sync fetched settings into local state for editing
    useEffect(() => {
        if (Object.keys(fetchedSettings).length > 0) {
            setSettings(fetchedSettings);
        }
    }, [fetchedSettings]);

    // Load dev mode
    useEffect(() => {
        const savedDevMode = localStorage.getItem('devMode') === 'true';
        setDevMode(savedDevMode);
    }, []);

    const saveSetting = async (key: string, value: string, type: string = 'string') => {
        saveSettingMutation.mutate({ key, value, type }, {
            onSuccess: () => {
                setSettings(prev => ({ ...prev, [key]: value }));
                toast.success("Setting saved");
            },
            onError: () => {
                toast.error("Failed to save setting");
            },
        });
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

        changePasswordMutation.mutate({ currentPassword, newPassword }, {
            onSuccess: () => {
                toast.success("Password changed successfully");
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            },
            onError: (error: unknown) => {
                const err = error as { response?: { data?: { detail?: string } } };
                const detail = err.response?.data?.detail || "Failed to change password";
                toast.error(detail);
            },
        });
    };

    const SidebarItem = ({ id, icon: Icon, label }: { id: string, icon: React.ElementType, label: string }) => (
        <button
            onClick={() => setActiveSection(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[5px] font-mono text-xs transition-colors ${activeSection === id
                ? 'bg-accent/15 text-accent font-medium border-l-2 border-accent'
                : 'text-text-soft hover:bg-raised hover:text-text'
                }`}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="panel p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[7px] bg-raised border border-line-strong flex items-center justify-center text-accent">
                        <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-semibold text-text tracking-tight">System Settings</h1>
                            <span className="status ok text-[10px] uppercase font-mono px-2 py-0.5">
                                PREFERENCES
                            </span>
                        </div>
                        <p className="text-xs text-text-soft font-mono mt-0.5">
                            Manage runtime configurations, visual themes, telemetry limits, and security
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] bg-panel border border-line-strong font-mono text-xs">
                    <span className="text-faint text-[10px] uppercase">Engine</span>
                    <button
                        onClick={toggleDevMode}
                        className={cn(
                            "status text-[9px] uppercase px-2 py-0.5 transition-colors",
                            devMode ? "ok" : "warn"
                        )}
                    >
                        {devMode ? 'DEV MODE' : 'PROD MODE'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Sidebar Navigation */}
                <nav className="panel p-2 space-y-1 self-start">
                    <div className="md:hidden flex overflow-x-auto pb-2 gap-1 scrollbar-hide">
                        {/* Mobile Horizontal Scroll */}
                        <SidebarItem id="account" icon={User} label="Account" />
                        <SidebarItem id="appearance" icon={Sun} label="Appearance" />
                        <SidebarItem id="monitoring" icon={Activity} label="Monitoring" />
                        <SidebarItem id="certificates" icon={ShieldCheck} label="SSL/TLS" />
                        <SidebarItem id="notifications" icon={Bell} label="Notifications" />
                        <SidebarItem id="reports" icon={FileText} label="Reports" />
                        <SidebarItem id="backup" icon={Download} label="Backup" />
                        {user?.is_admin && <SidebarItem id="audit" icon={ClipboardList} label="Audit Log" />}
                    </div>

                    <div className="hidden md:block space-y-1">
                        <SidebarItem id="account" icon={User} label="Account" />
                        <SidebarItem id="appearance" icon={Sun} label="Appearance" />
                        <SidebarItem id="monitoring" icon={Activity} label="Monitoring" />
                        <SidebarItem id="certificates" icon={ShieldCheck} label="SSL/TLS" />
                        <SidebarItem id="notifications" icon={Bell} label="Notifications" />
                        <SidebarItem id="reports" icon={FileText} label="Reports" />
                        <SidebarItem id="backup" icon={Download} label="Backup" />
                        {user?.is_admin && <SidebarItem id="audit" icon={ClipboardList} label="Audit Log" />}

                        {devMode && (
                            <div className="pt-2 mt-2 border-t border-line space-y-1">
                                <div className="px-3 text-[10px] font-mono text-faint uppercase tracking-wider mb-1">
                                    Developer
                                </div>
                                <SidebarItem id="developer" icon={Terminal} label="Internals" />
                            </div>
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
                                <div className="space-y-4">
                                    <div className="panel p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-[7px] bg-raised border border-line flex items-center justify-center text-accent">
                                                <User className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-text tracking-tight">{user?.full_name || user?.username || 'User'}</h2>
                                                <p className="text-xs text-text-soft font-mono mt-0.5">{user?.email || 'No email configured'}</p>
                                                <div className="mt-2 text-[10px] font-mono bg-raised text-accent px-2 py-0.5 rounded-[4px] inline-block border border-accent/20">
                                                    ROLE: {user?.is_admin ? 'ADMINISTRATOR' : 'GENERAL USER'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="panel p-5">
                                        <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold mb-4 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-accent" />
                                            Security & Password
                                        </h3>

                                        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                                            <div className="space-y-1">
                                                <label className="text-xs font-mono text-text-soft">Current Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-text placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-mono text-text-soft">New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-text placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-mono text-text-soft">Confirm New Password</label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-text placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
                                                    placeholder="••••••••"
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={changePasswordMutation.isPending}
                                                className="mt-2 bg-accent text-accent-foreground font-mono font-semibold py-1.5 px-4 rounded-[7px] text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                {changePasswordMutation.isPending ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Updating...
                                                    </>
                                                ) : (
                                                    'Update Password'
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Appearance Section */}
                            {activeSection === 'appearance' && (
                                <div className="space-y-8">
                                    {/* Theme Presets */}
                                    <section>
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold">Base Theme</h3>
                                            <span className="text-[11px] font-mono text-faint">Active: {presets[themeConfig.mode]?.name || themeConfig.mode}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.entries(presets).map(([key, theme]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => updateTheme({ mode: key as ThemeMode })}
                                                    className={`panel p-3 text-left transition-all hover:border-line-strong flex flex-col justify-between h-28 relative rounded-[7px] ${themeConfig.mode === key
                                                        ? 'border-accent ring-1 ring-accent/40 bg-raised/90'
                                                        : 'bg-panel border-line hover:bg-raised/40'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div>
                                                            <div className="font-semibold text-xs text-text font-mono">
                                                                {theme.name}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-faint uppercase">
                                                                {theme.type} mode
                                                            </div>
                                                        </div>
                                                        {themeConfig.mode === key && (
                                                            <div className="w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                                                                <Check className="w-2.5 h-2.5" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Mini UI Preview Palette */}
                                                    <div
                                                        className="w-full h-10 rounded-[5px] p-1.5 flex items-center justify-between border"
                                                        style={{
                                                            background: `hsl(${theme.colors['--background']})`,
                                                            borderColor: `hsl(${theme.colors['--border']})`
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <div
                                                                className="w-4 h-4 rounded-[3px] border"
                                                                style={{
                                                                    background: `hsl(${theme.colors['--card']})`,
                                                                    borderColor: `hsl(${theme.colors['--border']})`
                                                                }}
                                                            />
                                                            <div
                                                                className="w-10 h-2 rounded-[2px]"
                                                                style={{ background: `hsl(${theme.colors['--muted']})` }}
                                                            />
                                                        </div>
                                                        <div
                                                            className="w-3.5 h-3.5 rounded-full"
                                                            style={{ background: `hsl(${theme.colors['--primary']})` }}
                                                        />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Accent Color Selection */}
                                    <section>
                                        <h3 className="text-xs font-mono uppercase tracking-wider text-text font-semibold mb-3 px-1">Accent Color</h3>
                                        <div className="panel p-4 rounded-[7px]">
                                            <div className="flex flex-wrap gap-3">
                                                {accentColors.map((color) => (
                                                    <button
                                                        key={color.name}
                                                        onClick={() => updateTheme({ accent: color.value })}
                                                        className={`w-9 h-9 rounded-full relative transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-background ${themeConfig.accent === color.value ? 'ring-2 ring-text scale-105' : ''}`}
                                                        style={{ backgroundColor: color.hex }}
                                                        title={color.name}
                                                    >
                                                        {themeConfig.accent === color.value && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <Check className="w-4 h-4 text-white drop-shadow-md" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-line flex items-center gap-3">
                                                <div className="w-full h-1.5 rounded-full bg-raised overflow-hidden">
                                                    <div className="h-full bg-accent transition-all duration-300 w-2/3" />
                                                </div>
                                                <span className="text-[11px] font-mono text-faint whitespace-nowrap">Active Accent</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {/* Monitoring Section */}
                            {activeSection === 'monitoring' && (
                                <div className="panel p-5 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-[7px] bg-raised border border-line flex items-center justify-center text-accent">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-semibold text-text tracking-tight">Monitoring Intervals</h2>
                                            <p className="text-xs text-text-soft font-mono mt-0.5">Configure automated telemetry collection intervals</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-mono text-text">Ping Interval (seconds)</label>
                                                <span className="text-[11px] font-mono text-faint">Gateway & Google DNS</span>
                                            </div>
                                            <div className="flex gap-2 max-w-sm">
                                                <input
                                                    type="number"
                                                    className="bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-text w-full focus:outline-none focus:border-accent transition-colors"
                                                    value={settings['ping_interval'] || '5'}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, ping_interval: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveSetting('ping_interval', settings['ping_interval'] || '5', 'int')}
                                                    className="bg-accent hover:opacity-90 text-accent-foreground px-3 py-1.5 rounded-[7px] text-xs font-mono font-semibold transition-opacity flex items-center gap-1.5 shadow-sm"
                                                >
                                                    <Save className="w-3.5 h-3.5" />
                                                    SAVE
                                                </button>
                                            </div>
                                        </div>

                                        <div className="h-px bg-line" />

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-mono text-text">Speedtest Interval (minutes)</label>
                                                <span className="text-[11px] font-mono text-faint">0 = disabled</span>
                                            </div>
                                            <div className="flex gap-2 max-w-sm">
                                                <input
                                                    type="number"
                                                    className="bg-raised border border-line rounded-[7px] px-3 py-1.5 text-xs font-mono text-text w-full focus:outline-none focus:border-accent transition-colors"
                                                    value={settings['speedtest_interval'] || '180'}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, speedtest_interval: e.target.value }))}
                                                />
                                                <button
                                                    onClick={() => saveSetting('speedtest_interval', settings['speedtest_interval'] || '180', 'int')}
                                                    className="bg-accent hover:opacity-90 text-accent-foreground px-3 py-1.5 rounded-[7px] text-xs font-mono font-semibold transition-opacity flex items-center gap-1.5 shadow-sm"
                                                >
                                                    <Save className="w-3.5 h-3.5" />
                                                    SAVE
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Certificates Section */}
                            {activeSection === 'certificates' && (
                                <CertMonitor />
                            )}

                            {/* Notifications Section */}
                            {activeSection === 'notifications' && (
                                <NotificationSettings />
                            )}

                            {/* Reports Section */}
                            {activeSection === 'reports' && (
                                <ReportSettings />
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

                            {/* Audit Log Section */}
                            {activeSection === 'audit' && (
                                <AuditLogTab />
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
