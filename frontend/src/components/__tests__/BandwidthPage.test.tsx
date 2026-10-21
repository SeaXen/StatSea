import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BandwidthPage from '../BandwidthPage';

// Mock recharts ResponsiveContainer to avoid resize observer issues in test environment
vi.mock('recharts', async () => {
    const actual = await vi.importActual('recharts') as any;
    return {
        ...actual,
        ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    };
});

// Mock framer-motion to avoid animation timer stalls in jsdom
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: any) => (
            <div className={className} onClick={onClick} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../hooks/useBandwidth', () => ({
    useInterfaces: vi.fn(),
    useBandwidthSummary: vi.fn(),
    useBandwidthFiveMinute: vi.fn(),
    useBandwidthHourly: vi.fn(),
    useBandwidthDaily: vi.fn(),
    useBandwidthMonthly: vi.fn(),
    useBandwidthYearly: vi.fn(),
    useBandwidthTop: vi.fn(),
}));

import {
    useInterfaces,
    useBandwidthSummary,
    useBandwidthFiveMinute,
    useBandwidthHourly,
    useBandwidthDaily,
    useBandwidthMonthly,
    useBandwidthYearly,
    useBandwidthTop,
} from '../../hooks/useBandwidth';

describe('BandwidthPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (useInterfaces as any).mockReturnValue({
            data: ['eth0', 'wlan0'],
            isLoading: false,
        });

        (useBandwidthSummary as any).mockReturnValue({
            data: {
                eth0: {
                    today: { rx: 1048576, tx: 2097152, total: 3145728 },
                    yesterday: { rx: 5242880, tx: 5242880, total: 10485760 },
                    month: { rx: 104857600, tx: 104857600, total: 209715200 },
                    all_time: { rx: 500000000, tx: 500000000, total: 1000000000 },
                    estimated: { total: 314572800 },
                },
            },
            isLoading: false,
        });

        (useBandwidthFiveMinute as any).mockReturnValue({ data: [], isLoading: false });
        (useBandwidthHourly as any).mockReturnValue({ data: [], isLoading: false });
        (useBandwidthDaily as any).mockReturnValue({ data: [], isLoading: false });
        (useBandwidthMonthly as any).mockReturnValue({ data: [], isLoading: false });
        (useBandwidthYearly as any).mockReturnValue({ data: [], isLoading: false });
        (useBandwidthTop as any).mockReturnValue({ data: [], isLoading: false });
    });

    it('renders header, title, and action buttons', () => {
        render(<BandwidthPage />);

        expect(screen.getByText(/Traffic/i)).toBeInTheDocument();
        expect(screen.getByText(/Flux/i)).toBeInTheDocument();
        expect(screen.getByText(/Real-time throughput analysis/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /full report/i })).toBeInTheDocument();
    });

    it('renders active interface summary cards', () => {
        render(<BandwidthPage />);

        expect(screen.getByText('Current Day')).toBeInTheDocument();
        expect(screen.getByText('Prior Day')).toBeInTheDocument();
        expect(screen.getByText('Monthly Usage')).toBeInTheDocument();
        expect(screen.getByText('Historical Total')).toBeInTheDocument();
        expect(screen.getByText('Projected')).toBeInTheDocument();
    });

    it('renders formatted byte amounts in tabular figures', () => {
        render(<BandwidthPage />);

        // 3 MB for today total (3145728 bytes = 3 MB)
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getAllByText('MB').length).toBeGreaterThan(0);
    });
});
