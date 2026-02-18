import React from 'react';
import {
    LayoutDashboard,
    Server,
    Activity,
    Settings
} from 'lucide-react';

interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
    const items = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'devices', label: 'Devices', icon: Server },
        { id: 'analytics', label: 'Stats', icon: Activity },
        { id: 'settings', label: 'Setup', icon: Settings },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/10 px-6 py-3 pb-safe">
            <div className="flex justify-between items-center max-w-md mx-auto">
                {items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? 'text-blue-400' : 'text-gray-500'
                                }`}
                        >
                            <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-blue-500/10' : 'bg-transparent'
                                }`}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-medium tracking-wide uppercase">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
