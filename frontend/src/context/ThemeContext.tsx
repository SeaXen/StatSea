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

        // Step 1: Apply ALL base theme variables (including --accent and --accent-foreground)
        Object.entries(base.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Step 2: Apply accent color overrides on top of the base
        root.style.setProperty('--primary', config.accent);
        root.style.setProperty('--ring', config.accent);
        root.style.setProperty('--accent', config.accent);

        // Ensure foreground colors contrast properly with the accent
        // For dark themes, accent foregrounds should be light; for light themes, dark
        const contrastForeground = base.type === 'light'
            ? base.colors['--primary-foreground'] || '210 40% 98%'
            : base.colors['--primary-foreground'] || '222.2 47.4% 11.2%';
        root.style.setProperty('--primary-foreground', contrastForeground);
        root.style.setProperty('--accent-foreground', base.colors['--accent-foreground'] || contrastForeground);

        // Special handling for radius if Cyberpunk
        if (config.mode === 'cyberpunk') {
            root.style.setProperty('--radius', '0px');
        } else {
            root.style.setProperty('--radius', '0.75rem');
        }
    };

    const setDefaultTheme = () => {
        const def = { mode: 'dark' as ThemeMode, accent: accentColors[0].value };
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
                    accent: presets[legacyTheme as ThemeMode].colors['--primary']
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
            // Optional: Auto-switch accent to the preset's primary color for better default look
            if (preset) {
                newConfig.accent = preset.colors['--primary'];
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
