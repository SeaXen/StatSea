import { useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Server, Shield, Settings, Activity, Network } from 'lucide-react';
import { API_CONFIG } from '../config/apiConfig';


export function CommandPalette({ open, setOpen, changeTab }: { open: boolean, setOpen: (open: boolean | ((prev: boolean) => boolean)) => void, changeTab: (tab: string) => void }) {

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [setOpen]);

    return (
        <Command.Dialog
            open={open}
            onOpenChange={setOpen}
            label="Global Command Menu"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-full bg-background/80 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-2 z-50 text-foreground"
            overlayClassName="fixed inset-0 bg-background/50 backdrop-blur-sm z-40"
        >
            <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
                <Search className="w-5 h-5 text-muted-foreground mr-2" />
                <Command.Input
                    className="w-full bg-transparent border-none focus:outline-none p-4 text-lg placeholder:text-muted-foreground text-foreground"
                    placeholder="Type a command or search..."
                />
            </div>

            <Command.List className="max-h-[300px] overflow-y-auto p-2 scroll-py-2">
                <Command.Empty className="p-4 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

                <Command.Group heading="Navigation" className="text-xs text-muted-foreground font-medium mb-2 px-2">
                    <Command.Item
                        onSelect={() => { changeTab('dashboard'); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Dashboard</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('devices'); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                    >
                        <Server className="w-4 h-4" />
                        <span>Devices</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('network'); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                    >
                        <Network className="w-4 h-4" />
                        <span>Network Map</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('security'); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                    >
                        <Shield className="w-4 h-4" />
                        <span>Security</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('settings'); setOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                    </Command.Item>
                </Command.Group>

                <Command.Group heading="Actions" className="text-xs text-muted-foreground font-medium mb-2 px-2 mt-2">
                    <Command.Item
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg aria-selected:bg-accent aria-selected:text-accent-foreground cursor-pointer transition-colors"
                        onSelect={async () => {
                            setOpen(false);
                            try {
                                await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SPEEDTEST}`, { method: 'POST' });
                                window.dispatchEvent(new Event('speedtest-update'));
                            } catch (e) {
                                console.error('Speedtest failed', e);
                            }
                        }}
                    >
                        <Activity className="w-4 h-4" />
                        <span>Run Speedtest</span>
                    </Command.Item>
                </Command.Group>
            </Command.List>
        </Command.Dialog>
    );
}
