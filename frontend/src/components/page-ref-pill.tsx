interface PageRefPillProps {
  pages: number[]
  onClick: (page: number) => void
}

export function PageRefPill({ pages, onClick }: PageRefPillProps) {
  if (!pages || pages.length === 0) return null
  const label = pages.length === 1 ? `${pages[0]}` : pages.join(',')

  return (
    <span
      className="page-ref tabular-nums"
      role="button"
      tabIndex={0}
      title={`Found on page ${pages.join(', ')}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick(pages[0])
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick(pages[0])
        }
      }}
    >
      {label}
    </span>
  )
}
