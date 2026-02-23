import { describe, it, expect } from 'vitest';
import { formatBytes } from './lib/utils';

describe('formatBytes', () => {
    it('formats bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1234)).toBe('1.21 KB');
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });
});
