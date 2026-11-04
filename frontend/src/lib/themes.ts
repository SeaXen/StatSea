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
    dark: {
        name: "Dark (Console)",
        type: "dark",
        colors: {
            // Tailwind semantic HSL mappings (harmonized with console)
            "--background": "220 18% 7%",        // #0f1115
            "--foreground": "220 15% 93%",       // #e7e9ee
            "--card": "220 17% 10%",             // #15181e (Matches --panel, NOT pitch black)
            "--card-foreground": "220 15% 93%",
            "--popover": "220 18% 12%",          // #1a1e26 (Matches --raised)
            "--popover-foreground": "220 15% 93%",
            "--primary": "233 100% 74%",         // #7c8cff
            "--primary-foreground": "220 18% 7%",
            "--secondary": "220 18% 12%",
            "--secondary-foreground": "220 15% 93%",
            "--muted": "220 18% 12%",
            "--muted-foreground": "220 10% 59%", // #8b93a3
            "--accent": "233 100% 74%",
            "--accent-foreground": "220 18% 7%",
            "--destructive": "5 88% 63%",         // #f5604f
            "--destructive-foreground": "220 15% 93%",
            "--border": "220 17% 17%",           // #242933
            "--input": "220 20% 21%",            // #2b3140
            "--ring": "233 100% 74%",
            "--radius": "10px",

            // StatSea Console Hex Tokens
            "--bg": "#0f1115",
            "--bar": "#12151a",
            "--panel": "#15181e",
            "--raised": "#1a1e26",
            "--line": "#242933",
            "--line-soft": "#1e232c",
            "--line-strong": "#2b3140",
            "--text": "#e7e9ee",
            "--text-soft": "#b6bcc9",
            "--faint": "#5d6574",
            "--accent-soft": "rgba(124, 140, 255, 0.10)",
            "--upload": "#4fd1e8",
            "--ok": "#3dd68c",
            "--warn": "#f5a524",
            "--danger": "#f5604f"
        }
    },
    light: {
        name: "Light",
        type: "light",
        colors: {
            // Tailwind semantic HSL mappings
            "--background": "230 20% 97%",       // #f5f6fa
            "--foreground": "230 29% 12%",       // #151826
            "--card": "0 0% 100%",               // #ffffff
            "--card-foreground": "230 29% 12%",
            "--popover": "0 0% 100%",
            "--popover-foreground": "230 29% 12%",
            "--primary": "235 77% 61%",          // #4f5ce6
            "--primary-foreground": "0 0% 100%",
            "--secondary": "230 18% 95%",        // #edf0f7
            "--secondary-foreground": "230 29% 12%",
            "--muted": "230 18% 95%",
            "--muted-foreground": "230 15% 49%", // #6b7391
            "--accent": "235 77% 61%",
            "--accent-foreground": "0 0% 100%",
            "--destructive": "5 88% 60%",
            "--destructive-foreground": "0 0% 100%",
            "--border": "230 23% 91%",           // #e3e6ef
            "--input": "230 20% 86%",            // #d5d9e5
            "--ring": "235 77% 61%",
            "--radius": "10px",

            // StatSea Console Hex Tokens
            "--bg": "#f5f6fa",
            "--bar": "#ffffff",
            "--panel": "#ffffff",
            "--raised": "#edf0f7",
            "--line": "#e3e6ef",
            "--line-soft": "#edf0f7",
            "--line-strong": "#d5d9e5",
            "--text": "#151826",
            "--text-soft": "#4a5168",
            "--faint": "#98a0b5",
            "--accent-soft": "rgba(79, 92, 230, 0.08)",
            "--upload": "#0ea5e9",
            "--ok": "#16a34a",
            "--warn": "#d97706",
            "--danger": "#dc2626"
        }
    },
    cyberpunk: {
        name: "Cyberpunk",
        type: "dark",
        colors: {
            // Tailwind semantic HSL mappings
            "--background": "220 38% 7%",        // #0a0e17
            "--foreground": "54 95% 77%",        // #fef08a
            "--card": "222 43% 12%",             // #121a2d
            "--card-foreground": "54 95% 77%",
            "--popover": "222 41% 16%",          // #18223a
            "--popover-foreground": "54 95% 77%",
            "--primary": "48 96% 53%",           // #facc15
            "--primary-foreground": "220 38% 7%",
            "--secondary": "222 41% 16%",
            "--secondary-foreground": "54 95% 77%",
            "--muted": "222 41% 16%",
            "--muted-foreground": "215 20% 65%", // #94a3b8
            "--accent": "48 96% 53%",
            "--accent-foreground": "220 38% 7%",
            "--destructive": "0 91% 71%",
            "--destructive-foreground": "220 38% 7%",
            "--border": "221 41% 24%",           // #243356
            "--input": "221 39% 36%",            // #384e80
            "--ring": "48 96% 53%",
            "--radius": "4px",

            // StatSea Console Hex Tokens
            "--bg": "#0a0e17",
            "--bar": "#0e1422",
            "--panel": "#121a2d",
            "--raised": "#18223a",
            "--line": "#243356",
            "--line-soft": "#1b2640",
            "--line-strong": "#384e80",
            "--text": "#fef08a",
            "--text-soft": "#cbd5e1",
            "--faint": "#64748b",
            "--accent-soft": "rgba(250, 204, 21, 0.12)",
            "--upload": "#22d3ee",
            "--ok": "#4ade80",
            "--warn": "#fb923c",
            "--danger": "#f87171"
        }
    },
    dracula: {
        name: "Dracula",
        type: "dark",
        colors: {
            // Tailwind semantic HSL mappings
            "--background": "235 15% 14%",       // #1e1f29
            "--foreground": "60 30% 96%",        // #f8f8f2
            "--card": "231 15% 18%",             // #282a36
            "--card-foreground": "60 30% 96%",
            "--popover": "232 15% 24%",          // #343746
            "--popover-foreground": "60 30% 96%",
            "--primary": "326 100% 74%",         // #ff79c6
            "--primary-foreground": "231 15% 18%",
            "--secondary": "232 15% 24%",
            "--secondary-foreground": "60 30% 96%",
            "--muted": "232 15% 24%",
            "--muted-foreground": "225 27% 51%", // #6272a4
            "--accent": "326 100% 74%",
            "--accent-foreground": "231 15% 18%",
            "--destructive": "0 100% 67%",       // #ff5555
            "--destructive-foreground": "60 30% 96%",
            "--border": "232 14% 31%",           // #44475a
            "--input": "225 27% 51%",            // #6272a4
            "--ring": "326 100% 74%",
            "--radius": "8px",

            // StatSea Console Hex Tokens
            "--bg": "#1e1f29",
            "--bar": "#21222c",
            "--panel": "#282a36",
            "--raised": "#343746",
            "--line": "#44475a",
            "--line-soft": "#383a4c",
            "--line-strong": "#6272a4",
            "--text": "#f8f8f2",
            "--text-soft": "#d6d8e0",
            "--faint": "#6272a4",
            "--accent-soft": "rgba(255, 121, 198, 0.12)",
            "--upload": "#8be9fd",
            "--ok": "#50fa7b",
            "--warn": "#ffb86c",
            "--danger": "#ff5555"
        }
    },
    nord: {
        name: "Nord",
        type: "dark",
        colors: {
            // Tailwind semantic HSL mappings
            "--background": "220 17% 17%",       // #242933
            "--foreground": "218 27% 94%",       // #eceff4
            "--card": "220 16% 22%",             // #2e3440
            "--card-foreground": "218 27% 94%",
            "--popover": "222 16% 28%",          // #3b4252
            "--popover-foreground": "218 27% 94%",
            "--primary": "193 43% 67%",          // #88c0d0
            "--primary-foreground": "220 16% 22%",
            "--secondary": "222 16% 28%",
            "--secondary-foreground": "218 27% 94%",
            "--muted": "222 16% 28%",
            "--muted-foreground": "220 13% 56%", // #9ca3af
            "--accent": "193 43% 67%",
            "--accent-foreground": "220 16% 22%",
            "--destructive": "354 42% 56%",      // #bf616a
            "--destructive-foreground": "218 27% 94%",
            "--border": "220 16% 31%",           // #434c5e
            "--input": "220 17% 36%",            // #4c566a
            "--ring": "193 43% 67%",
            "--radius": "8px",

            // StatSea Console Hex Tokens
            "--bg": "#242933",
            "--bar": "#292e39",
            "--panel": "#2e3440",
            "--raised": "#3b4252",
            "--line": "#434c5e",
            "--line-soft": "#3b4252",
            "--line-strong": "#4c566a",
            "--text": "#eceff4",
            "--text-soft": "#d8dee9",
            "--faint": "#7b88a1",
            "--accent-soft": "rgba(136, 192, 208, 0.12)",
            "--upload": "#81a1c1",
            "--ok": "#a3be8c",
            "--warn": "#ebcb8b",
            "--danger": "#bf616a"
        }
    },
    midnight: {
        name: "Midnight",
        type: "dark",
        colors: {
            // Tailwind semantic HSL mappings
            "--background": "224 44% 7%",        // #0a0e1a
            "--foreground": "214 32% 91%",       // #e2e8f0
            "--card": "224 43% 13%",             // #131b30
            "--card-foreground": "214 32% 91%",
            "--popover": "224 42% 18%",          // #1a2440
            "--popover-foreground": "214 32% 91%",
            "--primary": "199 89% 60%",          // #38bdf8
            "--primary-foreground": "224 44% 7%",
            "--secondary": "224 42% 18%",
            "--secondary-foreground": "214 32% 91%",
            "--muted": "224 42% 18%",
            "--muted-foreground": "215 16% 47%", // #64748b
            "--accent": "199 89% 60%",
            "--accent-foreground": "224 44% 7%",
            "--destructive": "0 91% 71%",        // #f87171
            "--destructive-foreground": "214 32% 91%",
            "--border": "223 43% 23%",           // #223054
            "--input": "223 43% 31%",            // #2d4070
            "--ring": "199 89% 60%",
            "--radius": "8px",

            // StatSea Console Hex Tokens
            "--bg": "#0a0e1a",
            "--bar": "#0e1424",
            "--panel": "#131b30",
            "--raised": "#1a2440",
            "--line": "#223054",
            "--line-soft": "#1b2744",
            "--line-strong": "#2d4070",
            "--text": "#e2e8f0",
            "--text-soft": "#94a3b8",
            "--faint": "#475569",
            "--accent-soft": "rgba(56, 189, 248, 0.12)",
            "--upload": "#38bdf8",
            "--ok": "#34d399",
            "--warn": "#fbbf24",
            "--danger": "#f87171"
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
