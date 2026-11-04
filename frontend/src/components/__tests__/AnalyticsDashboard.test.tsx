import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnalyticsDashboard from '../AnalyticsDashboard';
import axiosInstance from '../../config/axiosInstance';

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    };
});

vi.mock('../DnsQueryLog', () => ({ default: () => <div data-testid="dns-query-log">DNS Query Log</div> }));
vi.mock('../NetworkComparison', () => ({ default: () => <div data-testid="network-comparison">Network Comparison</div> }));
vi.mock('../PredictionWidget', () => ({ default: () => <div data-testid="prediction-widget">Prediction Widget</div> }));
vi.mock('../YearlyStatsView', () => ({ default: () => <div data-testid="yearly-stats-view">Yearly Stats</div> }));
vi.mock('../TrafficCategoriesWidget', () => ({ default: () => <div data-testid="traffic-categories">Traffic Categories</div> }));
vi.mock('../NetworkTopology', () => ({ NetworkTopology: () => <div data-testid="network-topology">Network Topology</div> }));
vi.mock('../analytics/RulesModal', () => ({ RulesModal: () => <div data-testid="rules-modal">Rules Modal</div> }));
vi.mock('react-simple-maps', () => ({
    ComposableMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Geographies: () => <div />,
    Geography: () => <div />,
    Marker: () => <div />,
}));

vi.mock('../../config/axiosInstance', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}));

const mockSummary = {
    total_packets: 125000,
    total_bytes: 524288000,
    bandwidth_in: 45000000,
    bandwidth_out: 15000000,
    protocols: { TCP: 60, UDP: 30, DNS: 10 },
    packet_size_distribution: { '< 64B': 100, '64-512B': 500 },
    bytes_per_protocol: { TCP: 400000, UDP: 100000 },
    connection_types: { external: 40, internal: 60 },
    packet_log: [],
};

describe('AnalyticsDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url.includes('/analytics/summary')) return Promise.resolve({ data: mockSummary });
            if (url.includes('/analytics/history')) return Promise.resolve({ data: { bandwidth: [], latency: [] } });
            if (url.includes('/security/events')) return Promise.resolve({ data: [] });
            if (url.includes('/network/connections')) return Promise.resolve({ data: [] });
            if (url.includes('/analytics/heatmap')) return Promise.resolve({ data: [] });
            if (url.includes('/security/rules')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });
    });

    it('renders traffic analyzer heading, capture state, and control actions', async () => {
        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Traffic Analyzer')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /generate network summary report/i })).toBeInTheDocument();
            expect(screen.getByText('LIVE CAPTURE')).toBeInTheDocument();
        }, { timeout: 4000 });
    });

    it('toggles pause and resume telemetry state', async () => {
        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Traffic Analyzer')).toBeInTheDocument();
        }, { timeout: 4000 });

        const pauseBtn = screen.getByRole('button', { name: /pause/i });
        expect(pauseBtn).toBeInTheDocument();

        fireEvent.click(pauseBtn);
        expect(screen.getByText('PAUSED')).toBeInTheDocument();
    });

    it('switches between overview, dns, and security tabs', async () => {
        render(<AnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Traffic Analyzer')).toBeInTheDocument();
        }, { timeout: 4000 });

        // Switch to DNS inspector tab
        const dnsButtons = screen.getAllByRole('button', { name: /dns/i });
        // The subtab button is the one with text 'dns' in the tab navigation row
        const dnsTab = dnsButtons.find(b => b.className.includes('rounded-t-lg')) || dnsButtons[dnsButtons.length - 1];
        fireEvent.click(dnsTab);

        await waitFor(() => {
            expect(screen.getByTestId('dns-query-log')).toBeInTheDocument();
        }, { timeout: 4000 });
    });
});
