import * as React from "react"

const STORAGE_KEY = "sidebarWidth"
const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 288 // ~18rem, up from 16rem (256px)

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        return parsed
      }
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_WIDTH
}

export function useSidebarResize() {
  const [width, setWidth] = React.useState(getStoredWidth)
  const isDragging = React.useRef(false)
  const startX = React.useRef(0)
  const startWidth = React.useRef(0)

  const persistWidth = React.useCallback((w: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(w))
    } catch {
      // localStorage unavailable
    }
  }, [])

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width]
  )

  React.useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(newWidth)
    }

    function handleMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      // Persist on release
      setWidth((current) => {
        persistWidth(current)
        return current
      })
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [persistWidth])

  return {
    width,
    handleMouseDown,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  }
}
