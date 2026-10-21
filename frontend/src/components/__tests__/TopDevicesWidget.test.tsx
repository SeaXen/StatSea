import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TopDevicesWidget } from '../TopDevicesWidget';
import axiosInstance from '../../config/axiosInstance';

vi.mock('../../config/axiosInstance', () => ({
    default: {
        get: vi.fn(),
    },
}));

describe('TopDevicesWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders device traffic and formatted bytes after fetching data', async () => {
        const mockDevices = [
            {
                mac: 'aa:bb:cc:dd:ee:01',
                ip: '192.168.1.101',
                hostname: 'MacBook-Pro',
                upload: 1048576, // 1 MB
                download: 5242880, // 5 MB
                total: 6291456, // 6 MB
            },
            {
                mac: 'aa:bb:cc:dd:ee:02',
                ip: '192.168.1.102',
                hostname: 'iPhone-14',
                upload: 512000,
                download: 1024000,
                total: 1536000,
            },
        ];

        (axiosInstance.get as any).mockResolvedValueOnce({
            data: { top_devices: mockDevices },
        });

        render(<TopDevicesWidget />);

        expect(screen.getByText('Top Devices')).toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('MacBook-Pro')).toBeInTheDocument();
            expect(screen.getByText('iPhone-14')).toBeInTheDocument();
        });

        expect(screen.getByText('6.0 MB')).toBeInTheDocument();
        expect(axiosInstance.get).toHaveBeenCalledWith('/analytics/summary');
    });

    it('renders empty state message when no devices are present', async () => {
        (axiosInstance.get as any).mockResolvedValueOnce({
            data: { top_devices: [] },
        });

        render(<TopDevicesWidget />);

        await waitFor(() => {
            expect(screen.getByText('No device traffic detected yet')).toBeInTheDocument();
        });
    });

    it('triggers manual refresh on refresh button click', async () => {
        (axiosInstance.get as any).mockResolvedValue({
            data: { top_devices: [] },
        });

        render(<TopDevicesWidget />);

        const refreshBtn = screen.getByRole('button', { name: /refresh top devices/i });
        expect(refreshBtn).toBeInTheDocument();

        fireEvent.click(refreshBtn);

        await waitFor(() => {
            expect(axiosInstance.get).toHaveBeenCalledTimes(2);
        });
    });
});
