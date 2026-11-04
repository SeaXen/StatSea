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
                                                {accentColors.map((color) => {
                                                    const isSelected = themeConfig.accent === color.value || themeConfig.accent === color.hex;
                                                    return (
                                                        <button
                                                            key={color.name}
                                                            onClick={() => updateTheme({ accent: color.hex })}
                                                            className={`w-9 h-9 rounded-full relative transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-background ${isSelected ? 'ring-2 ring-text scale-105' : ''}`}
                                                            style={{ backgroundColor: color.hex }}
                                                            title={color.name}
                                                        >
                                                            {isSelected && (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
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
                                <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2.5 rounded-lg bg-ok/10 text-ok">
                                            <Download className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-semibold text-text font-mono">Data Management</h2>
                                            <p className="text-xs text-faint font-mono">Export your system data for backup or analysis</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 rounded-[var(--r-panel)] bg-raised border border-line">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <h3 className="text-xs font-semibold text-text font-mono mb-1">Export Database</h3>
                                                    <p className="text-xs text-faint font-mono max-w-md">
                                                        Download a complete JSON backup of all devices, traffic logs, speedtest results, and system configuration.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleExport}
                                                    disabled={isExporting}
                                                    className="flex items-center gap-1.5 bg-accent text-accent-foreground px-4 py-2 rounded-[7px] hover:opacity-90 transition-opacity font-mono text-xs font-medium shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                                                >
                                                    {isExporting ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Exporting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download className="w-4 h-4" />
                                                            Export Data
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-[7px] bg-warn/10 border border-warn/20 flex gap-2.5 font-mono text-xs text-warn">
                                            <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <p className="text-[11px]">
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
                                    <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel relative overflow-hidden">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2.5 rounded-lg bg-danger/10 text-danger">
                                                <Terminal className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-text font-mono">System Internals</h2>
                                                <p className="text-xs text-faint font-mono">Advanced controls for debugging and development</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-[var(--r-panel)] bg-raised border border-line space-y-3 font-mono">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Database className="w-4 h-4 text-warn" />
                                                        <span className="font-medium text-xs text-text">Local Storage</span>
                                                    </div>
                                                    <button
                                                        onClick={clearLocalStorage}
                                                        className="p-1.5 text-danger hover:bg-danger/10 rounded-[6px] transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-faint mb-1">
                                                        Current Theme Config:
                                                    </p>
                                                    <pre className="text-[10px] bg-panel p-2 rounded border border-line overflow-x-auto text-ok">
                                                        {JSON.stringify(themeConfig, null, 2)}
                                                    </pre>
                                                </div>
                                                <p className="text-[10px] text-faint">
                                                    Clear all client-side persistence including themes, auth tokens, and cached states.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-[var(--r-panel)] bg-raised border border-line space-y-3 font-mono">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck className="w-4 h-4 text-ok" />
                                                        <span className="font-medium text-xs text-text">Environment</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono bg-accent-soft text-accent px-2 py-0.5 rounded-[5px]">PROD</span>
                                                </div>
                                                <div className="space-y-1.5 text-xs text-faint">
                                                    <div className="flex justify-between">
                                                        <span>API Base:</span>
                                                        <span className="text-text">{API_CONFIG.BASE_URL}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>WS Endpoint:</span>
                                                        <span className="text-text">{API_CONFIG.WS_URL}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-[var(--r-panel)] bg-raised border border-line col-span-1 md:col-span-2 font-mono">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Cpu className="w-4 h-4 text-accent" />
                                                    <span className="font-medium text-xs text-text">Client Info</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 text-xs">
                                                    <div className="p-2.5 rounded-[6px] bg-panel border border-line">
                                                        <span className="text-faint text-[10px] block mb-0.5">User Agent</span>
                                                        <span className="text-text text-[11px] break-all">{navigator.userAgent}</span>
                                                    </div>
                                                    <div className="p-2.5 rounded-[6px] bg-panel border border-line">
                                                        <span className="text-faint text-[10px] block mb-0.5">Resolution</span>
                                                        <span className="text-text text-[11px]">{window.innerWidth}x{window.innerHeight}</span>
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
