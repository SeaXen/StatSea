/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeConfig, ThemeMode, accentColors, presets } from '../lib/themes';


interface ThemeContextType {
    themeConfig: ThemeConfig;
    setThemeConfig: (config: ThemeConfig) => void;
    updateTheme: (updates: Partial<ThemeConfig>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
        mode: 'dark',
        accent: accentColors[0].value
    });

    const applyTheme = (config: ThemeConfig) => {
        const root = document.documentElement;
        const base = presets[config.mode];

        if (!base) return;

        // Apply mode class for Tailwind dark mode selector
        if (config.mode === 'light') {
            root.classList.remove('dark');
            root.classList.add('light');
        } else {
            root.classList.remove('light');
            root.classList.add('dark');
        }

        // Step 1: Apply ALL base theme variables (including --accent, --bg, --panel, etc.)
        Object.entries(base.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Step 2: Apply custom accent color overrides only if user explicitly picked a custom accent
        if (config.accent && config.accent !== base.colors['--accent'] && config.accent !== base.colors['--primary']) {
            const customAccent = accentColors.find(a => a.value === config.accent || a.hex === config.accent);
            if (customAccent) {
                root.style.setProperty('--primary', customAccent.value);
                root.style.setProperty('--ring', customAccent.value);
                root.style.setProperty('--accent', customAccent.hex);
                root.style.setProperty('--accent-soft', `${customAccent.hex}1f`);
            } else if (config.accent.startsWith('#')) {
                root.style.setProperty('--accent', config.accent);
                root.style.setProperty('--accent-soft', `${config.accent}1f`);
            } else if (config.accent.includes('%')) {
                root.style.setProperty('--primary', config.accent);
                root.style.setProperty('--ring', config.accent);
                root.style.setProperty('--accent', `hsl(${config.accent})`);
            }
        }

        // Ensure foreground colors contrast properly with the accent
        const contrastForeground = base.type === 'light'
            ? base.colors['--primary-foreground'] || '210 40% 98%'
            : base.colors['--primary-foreground'] || '222.2 47.4% 11.2%';
        root.style.setProperty('--primary-foreground', contrastForeground);
        root.style.setProperty('--accent-foreground', base.colors['--accent-foreground'] || contrastForeground);

        // Radius handling
        if (base.colors['--radius']) {
            root.style.setProperty('--radius', base.colors['--radius']);
        }
    };

    const setDefaultTheme = () => {
        const def = { mode: 'dark' as ThemeMode, accent: presets.dark.colors['--accent'] };
        setThemeConfig(def);
        applyTheme(def);
        localStorage.setItem('themeConfig', JSON.stringify(def));
    };

    // Initial Load
    useEffect(() => {
        const savedThemeConfig = localStorage.getItem('themeConfig');
        const legacyTheme = localStorage.getItem('theme');

        if (savedThemeConfig) {
            try {
                const parsed = JSON.parse(savedThemeConfig);
                setThemeConfig(parsed);
                applyTheme(parsed);
            } catch (e) {
                console.error("Failed to parse theme config", e);
                setDefaultTheme();
            }
        } else if (legacyTheme) {
            if (presets[legacyTheme as ThemeMode]) {
                const newConfig: ThemeConfig = {
                    mode: legacyTheme as ThemeMode,
                    accent: presets[legacyTheme as ThemeMode].colors['--accent']
                };
                setThemeConfig(newConfig);
                applyTheme(newConfig);
                localStorage.setItem('themeConfig', JSON.stringify(newConfig));
            } else {
                setDefaultTheme();
            }
        } else {
            setDefaultTheme();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateTheme = (updates: Partial<ThemeConfig>) => {
        const newConfig = { ...themeConfig, ...updates };

        if (updates.mode) {
            const preset = presets[updates.mode];
            if (preset) {
                newConfig.accent = preset.colors['--accent'] || preset.colors['--primary'];
            }
        }

        setThemeConfig(newConfig);
        applyTheme(newConfig);
        localStorage.setItem('themeConfig', JSON.stringify(newConfig));
    };

    return (
        <ThemeContext.Provider value={{ themeConfig, setThemeConfig, updateTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
