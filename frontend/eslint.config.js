import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    // Global ignores
    { ignores: ['dist/**', 'node_modules/**'] },

    // Base JS recommended rules
    js.configs.recommended,

    // TypeScript + React rules for .ts/.tsx files
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh.default ?? reactRefresh,
        },
        rules: {
            // TypeScript recommended rules (manually applied since flat config spreads differ)
            ...tsPlugin.configs.recommended.rules,

            // React hooks recommended rules
            ...reactHooks.configs.recommended.rules,

            // React refresh
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],

            // Project-specific overrides
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

            // Disable base eslint rules that conflict with TS
            'no-unused-vars': 'off',
            'no-undef': 'off',
        },
    },
];
