export type ThemeMode = 'light' | 'dark' | 'cyberpunk' | 'dracula' | 'nord' | 'midnight';

export interface ThemeConfig {
    mode: ThemeMode;
    accent: string; // hex code or tailwind color name
}

export interface ThemeDefinition {
    name: string;
    type: 'light' | 'dark';
    colors: Record<string, string>;
}

export const presets: Record<ThemeMode, ThemeDefinition> = {
    light: {
        name: "Light",
        type: "light",
        colors: {
            "--background": "0 0% 100%",
            "--foreground": "240 10% 3.9%",
            "--card": "0 0% 100%",
            "--card-foreground": "240 10% 3.9%",
            "--popover": "0 0% 100%",
            "--popover-foreground": "240 10% 3.9%",
            "--primary": "240 5.9% 10%",
            "--primary-foreground": "0 0% 98%",
            "--secondary": "240 4.8% 95.9%",
            "--secondary-foreground": "240 5.9% 10%",
            "--muted": "240 4.8% 95.9%",
            "--muted-foreground": "240 3.8% 46.1%",
            "--accent": "240 4.8% 95.9%",
            "--accent-foreground": "240 5.9% 10%",
            "--destructive": "0 84.2% 60.2%",
            "--destructive-foreground": "0 0% 98%",
            "--border": "240 5.9% 90%",
            "--input": "240 5.9% 90%",
            "--ring": "240 10% 3.9%",
            "--radius": "0.5rem"
        }
    },
    dark: {
        name: "Dark (Default)",
        type: "dark",
        colors: {
            "--background": "240 10% 3.9%",
            "--foreground": "0 0% 98%",
            "--card": "240 10% 3.9%",
            "--card-foreground": "0 0% 98%",
            "--popover": "240 10% 3.9%",
            "--popover-foreground": "0 0% 98%",
            "--primary": "0 0% 98%",
            "--primary-foreground": "240 5.9% 10%",
            "--secondary": "240 3.7% 15.9%",
            "--secondary-foreground": "0 0% 98%",
            "--muted": "240 3.7% 15.9%",
            "--muted-foreground": "240 5% 64.9%",
            "--accent": "240 3.7% 15.9%",
            "--accent-foreground": "0 0% 98%",
            "--destructive": "0 62.8% 30.6%",
            "--destructive-foreground": "0 0% 98%",
            "--border": "240 3.7% 15.9%",
            "--input": "240 3.7% 15.9%",
            "--ring": "240 4.9% 83.9%",
            "--radius": "0.5rem"
        }
    },
    cyberpunk: {
        name: "Cyberpunk",
        type: "dark",
        colors: {
            "--background": "220 25% 7%",     // Deep Obsidian
            "--foreground": "60 100% 90%",     // Electric Yellow-White
            "--card": "220 25% 10%",
            "--card-foreground": "60 90% 95%",
            "--popover": "220 25% 8%",
            "--popover-foreground": "60 90% 95%",
            "--primary": "60 100% 50%",        // Neon Yellow
            "--primary-foreground": "220 25% 7%",
            "--secondary": "220 20% 16%",
            "--secondary-foreground": "60 100% 50%",
            "--muted": "220 20% 16%",
            "--muted-foreground": "220 15% 65%",
            "--accent": "175 95% 45%",        // Electric Teal
            "--accent-foreground": "220 25% 7%",
            "--destructive": "0 100% 50%",
            "--destructive-foreground": "220 25% 7%",
            "--border": "220 20% 24%",
            "--input": "220 20% 18%",
            "--ring": "60 100% 50%",
            "--radius": "0px"                  // Industrial sharp edges
        }
    },
    dracula: {
        name: "Dracula",
        type: "dark",
        colors: {
            "--background": "231 15% 18%",     // #282a36
            "--foreground": "60 30% 96%",      // #f8f8f2
            "--card": "231 15% 18%",
            "--card-foreground": "60 30% 96%",
            "--popover": "231 15% 18%",
            "--popover-foreground": "60 30% 96%",
            "--primary": "326 100% 74%",       // Pink #ff79c6
            "--primary-foreground": "231 15% 18%",
            "--secondary": "231 15% 26%",      // #44475a
            "--secondary-foreground": "60 30% 96%",
            "--muted": "231 15% 26%",
            "--muted-foreground": "231 15% 60%", // #6272a4
            "--accent": "231 15% 26%",
            "--accent-foreground": "60 30% 96%",
            "--destructive": "0 100% 67%",     // #ff5555
            "--destructive-foreground": "60 30% 96%",
            "--border": "231 15% 26%",
            "--input": "231 15% 26%",
            "--ring": "326 100% 74%",
            "--radius": "0.5rem"
        }
    },
    nord: {
        name: "Nord",
        type: "dark",
        colors: {
            "--background": "220 16% 22%",     // #2e3440
            "--foreground": "218 27% 92%",     // #d8dee9
            "--card": "220 16% 22%",
            "--card-foreground": "218 27% 92%",
            "--popover": "220 16% 22%",
            "--popover-foreground": "218 27% 92%",
            "--primary": "193 43% 67%",        // #88c0d0 Cyan
            "--primary-foreground": "220 16% 22%",
            "--secondary": "222 16% 28%",      // #3b4252
            "--secondary-foreground": "218 27% 92%",
            "--muted": "222 16% 28%",
            "--muted-foreground": "220 16% 45%",
            "--accent": "222 16% 28%",
            "--accent-foreground": "218 27% 92%",
            "--destructive": "354 42% 56%",    // #bf616a
            "--destructive-foreground": "218 27% 94%",
            "--border": "222 16% 28%",
            "--input": "222 16% 28%",
            "--ring": "193 43% 67%",
            "--radius": "0.5rem"
        }
    },
    midnight: {
        name: "Midnight",
        type: "dark",
        colors: {
            "--background": "224 71% 4%",      // Deep Navy
            "--foreground": "213 31% 91%",
            "--card": "224 71% 6%",
            "--card-foreground": "213 31% 91%",
            "--popover": "224 71% 5%",
            "--popover-foreground": "213 31% 91%",
            "--primary": "199 89% 48%",        // Ocean Cobalt Cyan
            "--primary-foreground": "210 40% 98%",
            "--secondary": "223 47% 11%",
            "--secondary-foreground": "210 40% 98%",
            "--muted": "223 47% 11%",
            "--muted-foreground": "215.4 16.3% 56.9%",
            "--accent": "216 34% 17%",
            "--accent-foreground": "210 40% 98%",
            "--destructive": "0 63% 31%",
            "--destructive-foreground": "210 40% 98%",
            "--border": "216 34% 17%",
            "--input": "216 34% 17%",
            "--ring": "199 89% 48%",
            "--radius": "0.75rem"
        }
    }
};

export const accentColors = [
    { name: 'Blue', value: '221.2 83.2% 53.3%', hex: '#3b82f6' },
    { name: 'Emerald', value: '160 84% 39%', hex: '#10b981' },
    { name: 'Cyan', value: '188.7 94.5% 42.7%', hex: '#06b6d4' },
    { name: 'Teal', value: '175.3 77.1% 26.1%', hex: '#14b8a6' },
    { name: 'Amber', value: '38 92% 50%', hex: '#f59e0b' },
    { name: 'Red', value: '0 84.2% 60.2%', hex: '#ef4444' },
    { name: 'Orange', value: '24.6 95% 53.1%', hex: '#f97316' },
];

export const legacyThemes: Record<string, ThemeConfig> = {
    'default': { mode: 'dark', accent: '221.2 83.2% 53.3%' }, // Blue
    // 'cyberpunk': { mode: 'cyberpunk', accent: '60 100% 50%' }, // We will map these directly to the new modes now
};
