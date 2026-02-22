import { useEffect } from 'react'

/**
 * Ensures the app is permanently in light mode.
 * Cleans up any stale 'dark' class or localStorage from prior sessions.
 */
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('theme')
  }, [])
}
