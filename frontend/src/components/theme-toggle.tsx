import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-sm bg-toggle-bg p-1">
      <button
        onClick={() => theme !== 'light' && onToggle()}
        className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-all duration-150 ${
          theme === 'light'
            ? 'bg-toggle-active opacity-100'
            : 'bg-transparent opacity-50 hover:opacity-70'
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
        Light
      </button>
      <button
        onClick={() => theme !== 'dark' && onToggle()}
        className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-all duration-150 ${
          theme === 'dark'
            ? 'bg-toggle-active opacity-100'
            : 'bg-transparent opacity-50 hover:opacity-70'
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
        Dark
      </button>
    </div>
  )
}
