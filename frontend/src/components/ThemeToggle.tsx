import { Moon, Sun } from "lucide-react"
import { useTheme } from "../context/ThemeContext"

export function ThemeToggle() {
    const { themeConfig, updateTheme } = useTheme()

    return (
        <button
            onClick={() => updateTheme({ mode: themeConfig.mode === 'light' ? 'dark' : 'light' })}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            title="Toggle theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
