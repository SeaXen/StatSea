import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopNav } from '../TopNav';

const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

// Mock contexts
const mockLogout = vi.fn();
let mockIsConnected = true;
let mockIsSynthetic = false;

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { username: 'testadmin', email: 'admin@statsea.dev', is_admin: true },
        logout: mockLogout,
    }),
}));

vi.mock('../../contexts/WebSocketContext', () => ({
    useWebSocket: () => ({
        unreadCount: 0,
        isConnected: mockIsConnected,
        isSynthetic: mockIsSynthetic,
    }),
}));

vi.mock('../ThemeToggle', () => ({
    ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

vi.mock('../NotificationCenter', () => ({
    NotificationCenter: () => <div data-testid="notification-center">Notifications</div>,
}));

describe('TopNav Component', () => {
    it('renders active tab title and LIVE SNIFFING badge when connected to hardware driver', () => {
        mockIsConnected = true;
        mockIsSynthetic = false;

        renderWithClient(<TopNav activeTab="overview" setActiveTab={vi.fn()} setCommandOpen={vi.fn()} onMenuClick={vi.fn()} />);

        expect(screen.getByText('overview')).toBeInTheDocument();
        expect(screen.getByText('LIVE SNIFFING')).toBeInTheDocument();
        expect(screen.queryByText('SIMULATION MODE')).not.toBeInTheDocument();
    });

    it('renders SIMULATION MODE badge when running on synthetic driver fallback', () => {
        mockIsConnected = true;
        mockIsSynthetic = true;

        renderWithClient(<TopNav activeTab="devices" setActiveTab={vi.fn()} setCommandOpen={vi.fn()} onMenuClick={vi.fn()} />);

        expect(screen.getByText('devices')).toBeInTheDocument();
        expect(screen.getByText('SIMULATION MODE')).toBeInTheDocument();
        expect(screen.queryByText('LIVE SNIFFING')).not.toBeInTheDocument();
    });

    it('hides telemetry badges when disconnected', () => {
        mockIsConnected = false;
        mockIsSynthetic = false;

        renderWithClient(<TopNav activeTab="bandwidth" setActiveTab={vi.fn()} setCommandOpen={vi.fn()} onMenuClick={vi.fn()} />);

        expect(screen.queryByText('LIVE SNIFFING')).not.toBeInTheDocument();
        expect(screen.queryByText('SIMULATION MODE')).not.toBeInTheDocument();
    });
});
