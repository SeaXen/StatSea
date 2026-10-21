import { Moon, Sun } from "lucide-react"
import { useTheme } from "../context/ThemeContext"

export function ThemeToggle() {
    const { themeConfig, updateTheme } = useTheme()

    return (
        <button
            onClick={() => updateTheme({ mode: themeConfig.mode === 'light' ? 'dark' : 'light' })}
            className="p-2 rounded-lg bg-secondary/80 border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            aria-label="Toggle theme"
            title="Toggle theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
