import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../context/ThemeContext';

describe('ThemeToggle', () => {
    it('renders with accessible aria-label', () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        );

        const toggleBtn = screen.getByRole('button', { name: /toggle theme/i });
        expect(toggleBtn).toBeInTheDocument();
        expect(toggleBtn).toHaveAttribute('aria-label', 'Toggle theme');
    });

    it('toggles mode on user interaction', () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        );

        const toggleBtn = screen.getByRole('button', { name: /toggle theme/i });
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        fireEvent.click(toggleBtn);
        expect(document.documentElement.classList.contains('light')).toBe(true);

        fireEvent.click(toggleBtn);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});
