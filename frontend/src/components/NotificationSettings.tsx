import { useState, useEffect } from 'react';
import { useNotificationChannels, useCreateNotificationChannel, useUpdateNotificationChannel, useDeleteNotificationChannel, useTestNotificationChannel } from '../hooks/useNotifications';
import { NotificationChannel, NotificationChannelType } from '../types';
import { Bell, Plus, Trash2, Play, Settings2, Loader2, ShieldCheck } from 'lucide-react';
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

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this channel?")) return;
        deleteChannelMutation.mutate(id, {
            onSuccess: () => toast.success("Channel deleted successfully"),
            onError: (err) => toast.error(`Failed to delete channel: ${(err as any).response?.data?.detail || err.message}`)
        });
    };

    const handleToggleEnable = async (channel: NotificationChannel) => {
        updateChannelMutation.mutate({ id: channel.id, data: { is_enabled: !channel.is_enabled } }, {
            onSuccess: () => toast.success(`Channel ${channel.is_enabled ? 'disabled' : 'enabled'}`),
            onError: (err) => toast.error(`Failed to update channel: ${(err as any).response?.data?.detail || err.message}`)
        });
    };

    const handleTest = async (id: number) => {
        toast.promise(testChannelMutation.mutateAsync(id), {
            loading: 'Sending test notification...',
            success: 'Test notification sent!',
            error: (err) => `Test failed: ${(err as any).response?.data?.detail || err.message}`
        });
    };

    return (
        <div className="space-y-8">
            <div className="p-8 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                            <Bell className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold">Notification Channels</h2>
                            <p className="text-muted-foreground">Configure where to receive system alerts</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> Add Channel
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {channels.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground bg-black/20 rounded-xl border border-border/20">
                                No notification channels configured.
                            </div>
                        ) : (
                            channels.map(channel => (
                                <div key={channel.id} className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10 group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${channel.is_enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground">{channel.name}</h3>
                                            <div className="flex gap-2 items-center text-xs text-muted-foreground">
                                                <span className="uppercase tracking-wider font-semibold">{channel.type}</span>
                                                <span>•</span>
                                                <span className={channel.is_enabled ? 'text-green-400' : 'text-red-400'}>
                                                    {channel.is_enabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggleEnable(channel)}
                                            className="p-2 text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                            title={channel.is_enabled ? "Disable Channel" : "Enable Channel"}
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleTest(channel.id)}
                                            className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                            title="Test Channel"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setEditingChannel(channel)}
                                            className="p-2 text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                            title="Edit Channel"
                                            disabled // Implement edit mode later
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(channel.id)}
                                            className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                            title="Delete Channel"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between p-6 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        Browser Push Notifications
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {pushStatus === 'unsupported'
                            ? 'Not supported by this browser'
                            : 'Receive alerts directly in your browser or on your phone'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isPushLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    <button
                        disabled={pushStatus === 'unsupported' || isPushLoading}
                        onClick={handlePushToggle}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${pushStatus === 'granted' ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${pushStatus === 'granted' ? 'left-7' : 'left-1'}`} />
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

function ChannelModal({ isOpen, onClose, existingChannel, onSave }: { isOpen: boolean, onClose: () => void, existingChannel: NotificationChannel | null, onSave: (data: any) => void }) {
    const [name, setName] = useState(existingChannel?.name || '');
    const [type, setType] = useState<NotificationChannelType>(existingChannel?.type || 'telegram');
    const [configStr, setConfigStr] = useState(existingChannel ? JSON.stringify(existingChannel.config, null, 2) : '{\n  "token": "",\n  "chat_id": ""\n}');
    const [events, setEvents] = useState<string[]>(existingChannel?.events || ['*']);

    // Auto-update templates
    useEffect(() => {
        if (!existingChannel) {
            switch (type) {
                case 'telegram': setConfigStr('{\n  "token": "your_bot_token",\n  "chat_id": "your_chat_id"\n}'); break;
                case 'discord': setConfigStr('{\n  "webhook_url": "https://discord.com/api/webhooks/..."\n}'); break;
                case 'slack': setConfigStr('{\n  "webhook_url": "https://hooks.slack.com/services/..."\n}'); break;
                case 'email': setConfigStr('{\n  "to": "admin@example.com",\n  "subject_prefix": "[StatSea Alert] "\n}'); break;
                case 'ntfy': setConfigStr('{\n  "topic": "mytopic",\n  "server": "https://ntfy.sh"\n}'); break;
            }
        }
    }, [type, existingChannel]);

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
        } catch (e) {
            toast.error("Invalid JSON configuration");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#12141a] border border-border/50 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border/20 flex justify-between items-center">
                    <h3 className="text-xl font-semibold">{existingChannel ? 'Edit Channel' : 'Add Channel'}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-black/40 border border-border/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/50"
                            placeholder="e.g. My Telegram Alerts"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select
                            value={type} onChange={e => setType(e.target.value as NotificationChannelType)}
                            disabled={!!existingChannel}
                            className="w-full bg-black/40 border border-border/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/50 appearance-none"
                        >
                            <option value="telegram">Telegram</option>
                            <option value="discord">Discord (Webhook)</option>
                            <option value="slack">Slack (Webhook)</option>
                            <option value="email">Email (SMTP)</option>
                            <option value="ntfy">ntfy.sh</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Configuration (JSON)</label>
                        <p className="text-xs text-muted-foreground mb-2">Provide the required keys for the selected provider.</p>
                        <textarea
                            value={configStr} onChange={e => setConfigStr(e.target.value)}
                            rows={6}
                            className="w-full bg-black/40 border border-border/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Events</label>
                        <input
                            value={events.join(',')} onChange={e => setEvents(e.target.value.split(',').map(s => s.trim()))}
                            className="w-full bg-black/40 border border-border/50 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/50"
                            placeholder="e.g. security.*, system.cpu_high, * for all"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-border/20 flex justify-end gap-3 bg-black/20 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-white/5 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl hover:opacity-90 font-medium">Save Channel</button>
                </div>
            </div>
        </div>
    );
}
