import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotificationChannels, useCreateNotificationChannel, useUpdateNotificationChannel, useDeleteNotificationChannel, useTestNotificationChannel } from '../hooks/useNotifications';
import { NotificationChannel, NotificationChannelType, NotificationChannelCreate } from '../types';
import { Bell, Plus, Trash2, Play, Settings2, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { pushNotifications } from '../utils/pushNotifications';

export default function NotificationSettings() {
    const { data: channels = [], isLoading } = useNotificationChannels();
    const createChannelMutation = useCreateNotificationChannel();
    const updateChannelMutation = useUpdateNotificationChannel();
    const deleteChannelMutation = useDeleteNotificationChannel();
    const testChannelMutation = useTestNotificationChannel();

    const [isAdding, setIsAdding] = useState(false);
    const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
    const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [isPushLoading, setIsPushLoading] = useState(false);

    useEffect(() => {
        const checkPush = async () => {
            const status = await pushNotifications.checkStatus();
            setPushStatus(status);
        };
        checkPush();
    }, []);

    const handlePushToggle = async () => {
        setIsPushLoading(true);
        try {
            if (pushStatus === 'granted') {
                await pushNotifications.unsubscribe();
                setPushStatus('default');
                toast.success("Unsubscribed from push notifications");
            } else {
                await pushNotifications.subscribe();
                setPushStatus('granted');
                toast.success("Subscribed to push notifications");
            }
        } catch (err) {
            toast.error("Failed to update push subscription");
            console.error(err);
        } finally {
            setIsPushLoading(false);
        }
    };

    const getErrorMessage = (err: unknown): string => {
        if (axios.isAxiosError(err)) {
            const data = err.response?.data as { detail?: string } | undefined;
            return data?.detail || err.message;
        }
        return err instanceof Error ? err.message : String(err);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this channel?")) return;
        deleteChannelMutation.mutate(id, {
            onSuccess: () => toast.success("Channel deleted successfully"),
            onError: (err) => toast.error(`Failed to delete channel: ${getErrorMessage(err)}`)
        });
    };

    const handleToggleEnable = async (channel: NotificationChannel) => {
        updateChannelMutation.mutate({ id: channel.id, data: { is_enabled: !channel.is_enabled } }, {
            onSuccess: () => toast.success(`Channel ${channel.is_enabled ? 'disabled' : 'enabled'}`),
            onError: (err) => toast.error(`Failed to update channel: ${getErrorMessage(err)}`)
        });
    };

    const handleTest = async (id: number) => {
        toast.promise(testChannelMutation.mutateAsync(id), {
            loading: 'Sending test notification...',
            success: 'Test notification sent!',
            error: (err) => `Test failed: ${getErrorMessage(err)}`
        });
    };

    return (
        <div className="space-y-6">
            <div className="panel p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-accent-soft text-accent">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-text font-mono">Notification Channels</h2>
                            <p className="text-xs text-faint font-mono">Configure where to receive system alerts</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3.5 py-1.5 rounded-[7px] hover:opacity-90 transition-opacity text-xs font-mono font-medium shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Channel
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {channels.length === 0 ? (
                            <div className="text-center p-8 text-faint bg-raised rounded-[var(--r-panel)] border border-line font-mono text-xs">
                                No notification channels configured.
                            </div>
                        ) : (
                            channels.map(channel => (
                                <div key={channel.id} className="flex items-center justify-between p-3.5 rounded-[var(--r-panel)] bg-raised border border-line group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${channel.is_enabled ? 'bg-accent-soft text-accent' : 'bg-panel text-faint'}`}>
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-text text-xs font-mono">{channel.name}</h3>
                                            <div className="flex gap-2 items-center text-[10px] text-faint font-mono mt-0.5">
                                                <span className="uppercase tracking-wider font-semibold">{channel.type}</span>
                                                <span>•</span>
                                                <span className={channel.is_enabled ? 'text-ok font-semibold' : 'text-danger font-semibold'}>
                                                    {channel.is_enabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleToggleEnable(channel)}
                                            className="p-1.5 text-text-soft hover:text-text bg-panel hover:bg-line-strong rounded-[7px] border border-line transition-colors"
                                            title={channel.is_enabled ? "Disable Channel" : "Enable Channel"}
                                        >
                                            <Settings2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleTest(channel.id)}
                                            className="p-1.5 text-accent bg-accent-soft hover:opacity-80 rounded-[7px] transition-opacity"
                                            title="Test Channel"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setEditingChannel(channel)}
                                            className="p-1.5 text-accent bg-accent-soft hover:opacity-80 rounded-[7px] transition-opacity"
                                            title="Edit Channel"
                                            disabled
                                        >
                                            <Settings2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(channel.id)}
                                            className="p-1.5 text-danger bg-danger/10 hover:bg-danger/20 rounded-[7px] transition-colors"
                                            title="Delete Channel"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="panel flex items-center justify-between p-5 md:p-6 rounded-[var(--r-panel)] border border-line bg-panel">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium text-text text-xs font-mono">
                        <ShieldCheck className="w-4 h-4 text-accent" />
                        Browser Push Notifications
                    </div>
                    <p className="text-xs text-faint font-mono">
                        {pushStatus === 'unsupported'
                            ? 'Not supported by this browser'
                            : 'Receive alerts directly in your browser or on your phone'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isPushLoading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
                    <button
                        disabled={pushStatus === 'unsupported' || isPushLoading}
                        onClick={handlePushToggle}
                        className={`w-11 h-6 rounded-full relative transition-colors duration-200 border border-line ${pushStatus === 'granted' ? 'bg-accent' : 'bg-raised'}`}
                    >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm ${pushStatus === 'granted' ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            {(isAdding || editingChannel) && (
                <ChannelModal
                    isOpen={isAdding || !!editingChannel}
                    onClose={() => { setIsAdding(false); setEditingChannel(null); }}
                    existingChannel={editingChannel}
                    onSave={(data) => {
                        if (editingChannel) {
                            updateChannelMutation.mutate({ id: editingChannel.id, data }, {
                                onSuccess: () => {
                                    setIsAdding(false);
                                    setEditingChannel(null);
                                    toast.success("Channel updated");
                                }
                            });
                        } else {
                            createChannelMutation.mutate(data, {
                                onSuccess: () => {
                                    setIsAdding(false);
                                    toast.success("Channel created");
                                }
                            });
                        }
                    }}
                />
            )}
        </div>
    );
}

const DEFAULT_CONFIG_TEMPLATES: Record<NotificationChannelType, string> = {
    telegram: '{\n  "token": "your_bot_token",\n  "chat_id": "your_chat_id"\n}',
    discord: '{\n  "webhook_url": "https://discord.com/api/webhooks/..."\n}',
    slack: '{\n  "webhook_url": "https://hooks.slack.com/services/..."\n}',
    email: '{\n  "to": "admin@example.com",\n  "subject_prefix": "[StatSea Alert] "\n}',
    ntfy: '{\n  "topic": "mytopic",\n  "server": "https://ntfy.sh"\n}',
    push: '{}',
};

function ChannelModal({ isOpen, onClose, existingChannel, onSave }: { isOpen: boolean, onClose: () => void, existingChannel: NotificationChannel | null, onSave: (data: NotificationChannelCreate) => void }) {
    const initialType: NotificationChannelType = existingChannel ? existingChannel.type : 'telegram';
    const [name, setName] = useState(existingChannel?.name || '');
    const [type, setType] = useState<NotificationChannelType>(initialType);
    const [configStr, setConfigStr] = useState(
        existingChannel
            ? JSON.stringify(existingChannel.config, null, 2)
            : DEFAULT_CONFIG_TEMPLATES[initialType]
    );
    const [events, setEvents] = useState<string[]>(existingChannel?.events || ['*']);

    const handleTypeChange = (newType: NotificationChannelType) => {
        setType(newType);
        if (!existingChannel) {
            setConfigStr(DEFAULT_CONFIG_TEMPLATES[newType] || '{}');
        }
    };

    if (!isOpen) return null;

    const handleSave = () => {
        try {
            const parsedConfig = JSON.parse(configStr);
            onSave({
                name,
                type,
                config: parsedConfig,
                events,
                is_enabled: true
            });
        } catch {
            toast.error("Invalid JSON configuration");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="panel bg-panel border border-line rounded-[var(--r-panel)] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 md:p-5 border-b border-line flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-text font-mono">{existingChannel ? 'Edit Channel' : 'Add Channel'}</h3>
                    <button onClick={onClose} aria-label="Close" className="text-faint hover:text-text p-1 rounded-[5px] hover:bg-panel transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 md:p-5 space-y-4 overflow-y-auto">
                    <div className="space-y-1.5">
                        <label className="text-xs font-mono text-faint">Name</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-accent"
                            placeholder="e.g. My Telegram Alerts"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-mono text-faint">Type</label>
                        <select
                            value={type} onChange={e => handleTypeChange(e.target.value as NotificationChannelType)}
                            disabled={!!existingChannel}
                            className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-accent"
                        >
                            <option value="telegram">Telegram</option>
                            <option value="discord">Discord (Webhook)</option>
                            <option value="slack">Slack (Webhook)</option>
                            <option value="email">Email (SMTP)</option>
                            <option value="ntfy">ntfy.sh</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-mono text-faint">Configuration (JSON)</label>
                        <p className="text-[10px] text-faint font-mono mb-1">Provide the required keys for the selected provider.</p>
                        <textarea
                            value={configStr} onChange={e => setConfigStr(e.target.value)}
                            rows={6}
                            className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-accent"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-mono text-faint">Events</label>
                        <input
                            value={events.join(',')} onChange={e => setEvents(e.target.value.split(',').map(s => s.trim()))}
                            className="w-full bg-raised border border-line rounded-[7px] px-3 py-1.5 font-mono text-xs text-text focus:outline-none focus:border-accent"
                            placeholder="e.g. security.*, system.cpu_high, * for all"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-line flex justify-end gap-2 bg-raised rounded-b-[var(--r-panel)]">
                    <button onClick={onClose} className="px-3 py-1.5 rounded-[7px] text-faint hover:text-text font-mono text-xs transition-colors">Cancel</button>
                    <button onClick={handleSave} className="bg-accent text-accent-foreground px-4 py-1.5 rounded-[7px] hover:opacity-90 font-mono text-xs font-medium">Save Channel</button>
                </div>
            </div>
        </div>
    );
}
