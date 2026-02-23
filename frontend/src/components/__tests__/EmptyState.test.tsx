import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
    it('renders with title and description', () => {
        render(<EmptyState title="No data" description="Nothing to show here" />);
        expect(screen.getByText('No data')).toBeInTheDocument();
        expect(screen.getByText('Nothing to show here')).toBeInTheDocument();
    });
});
