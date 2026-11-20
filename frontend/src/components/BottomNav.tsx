import { useCallback, useState } from 'react';
import {
    LayoutDashboard,
    Server,
    Activity,
    Settings,
    MoreHorizontal,
    Map,
    Globe2,
    Box,
    Wifi,
    Gauge,
    Cpu,
    History,
    Users,
    X
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

// All 8 destinations are listed; the backend still gates admin-only views (e.g. Users).
const moreItems = [
    { id: 'network', label: 'Map', icon: Map },
    { id: 'geo', label: 'Globe', icon: Globe2 },
    { id: 'containers', label: 'Containers', icon: Box },
    { id: 'bandwidth', label: 'Bandwidth', icon: Wifi },
    { id: 'speedtest', label: 'Speed', icon: Gauge },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'sessions', label: 'Sessions', icon: History },
    { id: 'users', label: 'Users', icon: Users },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const closeSheet = useCallback(() => setMoreOpen(false), []);
    const modalRef = useModalA11y<HTMLDivElement>({ isOpen: moreOpen, onClose: closeSheet });

    const items = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'devices', label: 'Devices', icon: Server },
        { id: 'analytics', label: 'Stats', icon: Activity },
        { id: 'settings', label: 'Setup', icon: Settings },
    ];

    const navigate = (id: string) => {
        setActiveTab(id);
        setMoreOpen(false);
    };

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel/95 backdrop-blur-xl border-t border-line px-6 py-3 pb-safe">
                <div role="tablist" aria-label="Mobile navigation" className="flex justify-between items-center max-w-md mx-auto">
                    {items.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex flex-col items-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded ${isActive ? 'text-accent font-bold' : 'text-faint hover:text-text'
                                    }`}
                                aria-label={`Navigate to ${item.label}`}
                            >
                                <div className={`p-1.5 rounded-[7px] transition-colors ${isActive ? 'bg-accent/15 text-accent' : 'bg-transparent'
                                    }`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold tracking-wider uppercase">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setMoreOpen(true)}
                        aria-label="More destinations"
                        aria-expanded={moreOpen}
                        className="flex flex-col items-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded text-faint hover:text-text"
                    >
                        <div className="p-1.5 rounded-[7px] transition-colors bg-transparent">
                            <MoreHorizontal className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold tracking-wider uppercase">More</span>
                    </button>
                </div>
            </nav>

            {moreOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeSheet(); }}
                >
                    <div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="more-nav-title"
                        tabIndex={-1}
                        className="w-full bg-panel border border-line rounded-t-[var(--r-panel)] p-5 pb-safe shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 id="more-nav-title" className="text-sm font-semibold text-text font-mono uppercase tracking-wider">
                                More Destinations
                            </h2>
                            <button
                                type="button"
                                onClick={closeSheet}
                                aria-label="Close more destinations"
                                className="p-1 hover:bg-raised rounded text-faint hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {moreItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigate(item.id)}
                                    aria-label={`Navigate to ${item.label}`}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-[7px] border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${activeTab === item.id
                                        ? 'bg-accent/15 border-accent/30 text-accent'
                                        : 'bg-raised border-line text-faint hover:text-text'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="text-[10px] font-bold tracking-wider uppercase">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
