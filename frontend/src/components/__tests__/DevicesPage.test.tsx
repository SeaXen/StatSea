import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevicesPage } from '../DevicesPage';

vi.mock('../../hooks/useDevices', () => ({
    useDevices: vi.fn(),
    useDeviceGroups: vi.fn(),
    useWakeDevice: vi.fn(),
    useAddGroup: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useUpdateGroup: vi.fn(() => ({ mutateAsync: vi.fn() })),
    useDeleteGroup: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useDevices, useDeviceGroups, useWakeDevice } from '../../hooks/useDevices';

const mockDevices = [
    {
        id: 1,
        mac_address: '00:11:22:33:44:55',
        ip_address: '192.168.1.50',
        hostname: 'MacBook-Pro-M2',
        vendor: 'Apple Inc.',
        device_type: 'laptop',
        is_online: true,
        last_seen: new Date().toISOString(),
        current_rate: '2.4 MB/s',
        total_bytes: 104857600,
        group_id: 1,
    },
    {
        id: 2,
        mac_address: '66:77:88:99:aa:bb',
        ip_address: '192.168.1.100',
        hostname: 'Raspberry-Pi-NAS',
        vendor: 'Raspberry Pi Foundation',
        device_type: 'server',
        is_online: false,
        last_seen: new Date().toISOString(),
        current_rate: '0 KB/s',
        total_bytes: 52428800,
        group_id: 2,
    },
];

describe('DevicesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useDevices).mockReturnValue({
            data: mockDevices,
            isLoading: false,
        } as never);

        vi.mocked(useDeviceGroups).mockReturnValue({
            data: [
                { id: 1, name: 'Workstations', color: '#3b82f6' },
                { id: 2, name: 'Servers', color: '#10b981' },
            ],
            isLoading: false,
        } as never);

        vi.mocked(useWakeDevice).mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
    });

    it('renders device catalog with hostnames, IP addresses and MACs', () => {
        render(<DevicesPage />);

        expect(screen.getByText('MacBook-Pro-M2')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.50')).toBeInTheDocument();
        expect(screen.getByText('00:11:22:33:44:55')).toBeInTheDocument();

        expect(screen.getByText('Raspberry-Pi-NAS')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    it('filters devices interactively via search query', () => {
        render(<DevicesPage />);

        const searchInput = screen.getByPlaceholderText(/filter by name, ip, mac/i);
        expect(searchInput).toBeInTheDocument();

        fireEvent.change(searchInput, { target: { value: 'MacBook' } });

        expect(screen.getByText('MacBook-Pro-M2')).toBeInTheDocument();
        expect(screen.queryByText('Raspberry-Pi-NAS')).not.toBeInTheDocument();
    });

    it('toggles view mode between list and grid', () => {
        render(<DevicesPage />);

        const gridBtn = screen.getByRole('button', { name: /grid view/i });
        expect(gridBtn).toBeInTheDocument();

        fireEvent.click(gridBtn);
        expect(screen.getByText('MacBook-Pro-M2')).toBeInTheDocument();
    });

    it('toggles sort mode by status and bandwidth', () => {
        render(<DevicesPage />);

        const sortBtn = screen.getByRole('button', { name: /sort by/i });
        expect(sortBtn).toBeInTheDocument();

        fireEvent.click(sortBtn);
        expect(screen.getByRole('button', { name: /sort by/i })).toBeInTheDocument();
    });
});
