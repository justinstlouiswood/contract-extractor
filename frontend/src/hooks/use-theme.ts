import { useEffect } from 'react'

/**
 * Dark-only theme hook.
 * Always applies the `dark` class so the app renders in permanent dark mode.
 */
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
}
