import { useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Server, Shield, Settings, Activity, Network } from 'lucide-react';
import axiosInstance from '../config/axiosInstance';


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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] max-w-[94vw] bg-panel border border-line-strong rounded-[9px] shadow-2xl p-2 z-50 text-text font-sans"
            overlayClassName="fixed inset-0 bg-[#0f1115]/80 backdrop-blur-none z-40"
        >
            <div className="flex items-center border-b border-line px-3 py-1" cmdk-input-wrapper="">
                <Search className="w-4 h-4 text-muted mr-2" />
                <Command.Input
                    className="w-full bg-transparent border-none focus:outline-none p-2.5 text-xs font-mono placeholder:text-faint text-text"
                    placeholder="Search operations, devices, tabs… (Type / for commands)"
                />
                <kbd className="mono text-[10px] text-faint ml-auto bg-raised border border-line px-1.5 py-0.5 rounded-[4px]">ESC</kbd>
            </div>

            <Command.List className="max-h-[300px] overflow-y-auto p-1.5 scroll-py-1">
                <Command.Empty className="p-4 text-center text-xs font-mono text-muted">No telemetry or commands found.</Command.Empty>

                <Command.Group heading="Navigation Views" className="text-[10px] uppercase font-mono tracking-wider text-faint mb-1 px-2.5 pt-2">
                    <Command.Item
                        onSelect={() => { changeTab('dashboard'); setOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                    >
                        <LayoutDashboard className="w-3.5 h-3.5 text-accent" />
                        <span>Overview</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('devices'); setOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                    >
                        <Server className="w-3.5 h-3.5 text-accent" />
                        <span>Devices & Interfaces</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('network'); setOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                    >
                        <Network className="w-3.5 h-3.5 text-accent" />
                        <span>Network Map</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('security'); setOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                    >
                        <Shield className="w-3.5 h-3.5 text-accent" />
                        <span>Security Audits</span>
                    </Command.Item>
                    <Command.Item
                        onSelect={() => { changeTab('settings'); setOpen(false); }}
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5 text-accent" />
                        <span>Console Settings</span>
                    </Command.Item>
                </Command.Group>

                <Command.Group heading="Active Commands" className="text-[10px] uppercase font-mono tracking-wider text-faint mb-1 px-2.5 pt-2">
                    <Command.Item
                        className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-mono text-text rounded-[5px] aria-selected:bg-raised aria-selected:text-accent cursor-pointer transition-colors"
                        onSelect={async () => {
                            setOpen(false);
                            try {
                                await axiosInstance.post('/speedtest');
                                window.dispatchEvent(new Event('speedtest-update'));
                            } catch (e) {
                                console.error('Speedtest failed', e);
                            }
                        }}
                    >
                        <Activity className="w-3.5 h-3.5 text-upload" />
                        <span>Trigger WAN Latency / Speed Test</span>
                    </Command.Item>
                </Command.Group>
            </Command.List>
        </Command.Dialog>
    );
}
