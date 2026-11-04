import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SpeedtestPage from '../SpeedtestPage';
import SpeedtestService from '../../services/SpeedtestService';

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    };
});

// Mock framer-motion to avoid animation timer stalls in jsdom
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} onClick={onClick} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../config/axiosInstance', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('../../services/SpeedtestService', () => ({
    default: {
        getHistory: vi.fn(),
        runSpeedtest: vi.fn(),
    },
}));

const mockHistory = [
    {
        id: 1,
        timestamp: new Date().toISOString(),
        download: 850000000, // 850 Mbps
        upload: 450000000,   // 450 Mbps
        ping: 12,
        jitter: 2,
        server: { id: '1', name: 'Cloudflare Edge', country: 'Germany' },
        client: { ip: '203.0.113.19', isp: 'SuperFast Fiber' },
        isp: 'SuperFast Fiber',
        provider: 'ookla' as const,
    },
];

describe('SpeedtestPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(SpeedtestService.getHistory).mockResolvedValue(mockHistory);
    });

    it('renders heading, benchmark engine indicator, and action triggers', async () => {
        render(<SpeedtestPage />);

        expect(screen.getByText('Speedtest Intelligence')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /run benchmark/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(SpeedtestService.getHistory).toHaveBeenCalled();
            expect(screen.getAllByText('Download').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Upload').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Ping').length).toBeGreaterThan(0);
        }, { timeout: 4000 });
    });

    it('opens settings modal on settings button click', async () => {
        render(<SpeedtestPage />);

        const settingsBtn = screen.getByRole('button', { name: /settings/i });
        fireEvent.click(settingsBtn);

        await waitFor(() => {
            expect(screen.getByText(/speedtest automation/i)).toBeInTheDocument();
        }, { timeout: 4000 });
    });
});
