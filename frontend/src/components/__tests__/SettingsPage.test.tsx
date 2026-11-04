import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../SettingsPage';

// Mock framer-motion to avoid animation timer stalls in jsdom
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} onClick={onClick} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../context/ThemeContext', () => ({
    useTheme: vi.fn(),
}));

vi.mock('../../hooks/useSettings', () => ({
    useSettings: vi.fn(),
    useSaveSetting: vi.fn(),
    useChangePassword: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings, useSaveSetting, useChangePassword } from '../../hooks/useSettings';

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useAuth).mockReturnValue({
            user: { id: 1, username: 'admin', email: 'admin@statsea.local', full_name: 'Sys Admin', is_admin: true },
            token: 'test-token',
            refreshToken: 'test-refresh',
            login: vi.fn(),
            logout: vi.fn(),
            isLoading: false,
        });

        vi.mocked(useTheme).mockReturnValue({
            themeConfig: { mode: 'dark', accent: '#3b82f6' },
            setThemeConfig: vi.fn(),
            updateTheme: vi.fn(),
        });

        vi.mocked(useSettings).mockReturnValue({
            data: {
                bandwidth_warning_threshold: '80',
                packet_retention_days: '14',
            },
            isLoading: false,
        } as never);

        vi.mocked(useSaveSetting).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as never);

        vi.mocked(useChangePassword).mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as never);
    });

    it('renders system settings title, engine status, and primary navigation tabs', () => {
        render(<Settings />);

        expect(screen.getByText('System Settings')).toBeInTheDocument();
        expect(screen.getAllByText('Appearance').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Account').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Monitoring').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Backup').length).toBeGreaterThan(0);
    });

    it('switches between configuration sections interactively', () => {
        render(<Settings />);

        // Switch to Account section
        const accountBtns = screen.getAllByRole('button', { name: /account/i });
        fireEvent.click(accountBtns[0]);

        expect(screen.getByText('Security & Password')).toBeInTheDocument();
        expect(screen.getByText('Sys Admin')).toBeInTheDocument();
        expect(screen.getByText('Current Password')).toBeInTheDocument();
    });

    it('switches to monitoring section and displays interval controls', () => {
        render(<Settings />);

        const monitoringBtns = screen.getAllByRole('button', { name: /monitoring/i });
        fireEvent.click(monitoringBtns[0]);

        expect(screen.getByText('Monitoring Intervals')).toBeInTheDocument();
        expect(screen.getByText(/Ping Interval/i)).toBeInTheDocument();
    });
});
