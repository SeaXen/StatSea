import { Moon, Sun } from "lucide-react"
import { useTheme } from "../context/ThemeContext"

export function ThemeToggle() {
    const { themeConfig, updateTheme } = useTheme()
    const isDark = themeConfig.mode === 'dark'

    return (
        <button
            type="button"
            onClick={() => updateTheme({ mode: isDark ? 'light' : 'dark' })}
            className="relative w-[30px] h-[30px] rounded-[7px] border border-line-strong bg-panel hover:bg-raised text-muted hover:text-text flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:border-accent"
            aria-label="Toggle theme"
            title="Toggle theme"
        >
            {isDark ? (
                <Moon className="w-3.5 h-3.5 text-accent transition-transform" />
            ) : (
                <Sun className="w-3.5 h-3.5 text-warn transition-transform" />
            )}
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
