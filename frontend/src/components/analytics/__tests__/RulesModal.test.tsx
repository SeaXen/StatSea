import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RulesModal } from '../RulesModal';
import { SecurityRule } from '../../AnalyticsDashboard';

describe('RulesModal', () => {
    const mockRules: SecurityRule[] = [
        {
            id: 1,
            name: 'High Packet Rate Alert',
            description: 'Trigger when packet rate exceeds normal baseline',
            condition: 'packets > 1000',
            action: 'alert',
            is_active: true,
        },
    ];

    it('returns null when isOpen is false', () => {
        const { container } = render(
            <RulesModal
                isOpen={false}
                onClose={vi.fn()}
                rules={[]}
                rulesLoading={false}
                editingRule={null}
                setEditingRule={vi.fn()}
                onSaveRule={vi.fn()}
                onDeleteRule={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders modal header, description, and rules list when open', () => {
        render(
            <RulesModal
                isOpen={true}
                onClose={vi.fn()}
                rules={mockRules}
                rulesLoading={false}
                editingRule={null}
                setEditingRule={vi.fn()}
                onSaveRule={vi.fn()}
                onDeleteRule={vi.fn()}
            />
        );

        expect(screen.getByText('Security Alert Rules')).toBeInTheDocument();
        expect(screen.getByText('High Packet Rate Alert')).toBeInTheDocument();
        expect(screen.getByText('packets > 1000')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /new rule/i })).toBeInTheDocument();
    });

    it('triggers onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <RulesModal
                isOpen={true}
                onClose={onClose}
                rules={[]}
                rulesLoading={false}
                editingRule={null}
                setEditingRule={vi.fn()}
                onSaveRule={vi.fn()}
                onDeleteRule={vi.fn()}
            />
        );

        const closeBtn = screen.getByRole('button', { name: /close rules configuration/i });
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });
});
