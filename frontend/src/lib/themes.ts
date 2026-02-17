export interface Theme {
    name: string;
    colors: Record<string, string>;
}

export const themes: Record<string, Theme> = {
    default: {
        name: "Ocean Dark (Default)",
        colors: {
            "--background": "222.2 84% 4.9%",
            "--foreground": "210 40% 98%",
            "--card": "222.2 84% 4.9%",
            "--card-foreground": "210 40% 98%",
            "--popover": "222.2 84% 4.9%",
            "--popover-foreground": "210 40% 98%",
            "--primary": "210 40% 98%",
            "--primary-foreground": "222.2 47.4% 11.2%",
            "--secondary": "217.2 32.6% 17.5%",
            "--secondary-foreground": "210 40% 98%",
            "--muted": "217.2 32.6% 17.5%",
            "--muted-foreground": "215 20.2% 65.1%",
            "--accent": "217.2 32.6% 17.5%",
            "--accent-foreground": "210 40% 98%",
            "--destructive": "0 62.8% 30.6%",
            "--destructive-foreground": "210 40% 98%",
            "--border": "217.2 32.6% 17.5%",
            "--input": "217.2 32.6% 17.5%",
            "--ring": "212.7 26.8% 83.9%",
            "--radius": "0.5rem"
        }
    },
    cyberpunk: {
        name: "Cyberpunk",
        colors: {
            "--background": "260 50% 10%",
            "--foreground": "280 20% 90%",
            "--card": "260 50% 12%",
            "--card-foreground": "280 20% 90%",
            "--popover": "260 50% 12%",
            "--popover-foreground": "280 20% 90%",
            "--primary": "300 100% 50%",
            "--primary-foreground": "260 50% 10%",
            "--secondary": "180 100% 50%",
            "--secondary-foreground": "260 50% 10%",
            "--muted": "260 30% 20%",
            "--muted-foreground": "280 20% 70%",
            "--accent": "60 100% 50%",
            "--accent-foreground": "260 50% 10%",
            "--destructive": "0 100% 50%",
            "--destructive-foreground": "260 50% 10%",
            "--border": "280 40% 30%",
            "--input": "280 40% 30%",
            "--ring": "300 100% 50%",
            "--radius": "0rem"
        }
    },
    dracula: {
        name: "Dracula",
        colors: {
            "--background": "231 15% 18%",
            "--foreground": "60 30% 96%",
            "--card": "231 15% 20%",
            "--card-foreground": "60 30% 96%",
            "--popover": "231 15% 20%",
            "--popover-foreground": "60 30% 96%",
            "--primary": "326 100% 74%",
            "--primary-foreground": "231 15% 18%",
            "--secondary": "265 89% 78%",
            "--secondary-foreground": "231 15% 18%",
            "--muted": "231 15% 30%",
            "--muted-foreground": "231 10% 70%",
            "--accent": "135 94% 65%",
            "--accent-foreground": "231 15% 18%",
            "--destructive": "0 100% 67%",
            "--destructive-foreground": "231 15% 18%",
            "--border": "231 15% 40%",
            "--input": "231 15% 40%",
            "--ring": "326 100% 74%",
            "--radius": "0.5rem"
        }
    },
    nord: {
        name: "Nord",
        colors: {
            "--background": "220 16% 22%", // #2e3440
            "--foreground": "218 27% 92%", // #eceff4
            "--card": "220 16% 24%", // #3b4252
            "--card-foreground": "218 27% 92%",
            "--popover": "220 16% 24%",
            "--popover-foreground": "218 27% 92%",
            "--primary": "193 43% 67%", // #88c0d0
            "--primary-foreground": "220 16% 22%",
            "--secondary": "213 32% 52%", // #5e81ac
            "--secondary-foreground": "218 27% 92%",
            "--muted": "220 16% 28%", // #434c5e
            "--muted-foreground": "218 27% 92%",
            "--accent": "179 25% 65%", // #8fbcbb
            "--accent-foreground": "220 16% 22%",
            "--destructive": "354 42% 56%", // #bf616a
            "--destructive-foreground": "218 27% 92%",
            "--border": "220 16% 28%",
            "--input": "220 16% 28%",
            "--ring": "193 43% 67%",
            "--radius": "0.5rem"
        }
    },
    midnight: {
        name: "Midnight Pro",
        colors: {
            "--background": "224 71% 4%", // #020617
            "--foreground": "210 40% 98%",
            "--card": "217 33% 17%", // #1e293b
            "--card-foreground": "210 40% 98%",
            "--popover": "224 71% 4%",
            "--popover-foreground": "215 20.2% 65.1%",
            "--primary": "263.4 70% 50.4%", // #6d28d9
            "--primary-foreground": "210 40% 98%",
            "--secondary": "215 27.9% 16.9%",
            "--secondary-foreground": "210 40% 98%",
            "--muted": "215 27.9% 16.9%",
            "--muted-foreground": "215 20.2% 65.1%",
            "--accent": "215 27.9% 16.9%",
            "--accent-foreground": "210 40% 98%",
            "--destructive": "0 62.8% 30.6%",
            "--destructive-foreground": "210 40% 98%",
            "--border": "215 27.9% 16.9%",
            "--input": "215 27.9% 16.9%",
            "--ring": "263.4 70% 50.4%",
            "--radius": "0.5rem"
        }
    }
};
