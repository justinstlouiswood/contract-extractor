import { Badge } from '@/components/ui/badge'

interface PageRefPillProps {
  pages: number[]
  onClick: (page: number) => void
}

export function PageRefPill({ pages, onClick }: PageRefPillProps) {
  if (!pages || pages.length === 0) return null
  const label = pages.length === 1 ? `${pages[0]}` : pages.join(',')

  return (
    <Badge
      variant="outline"
      className="cursor-pointer text-xs tabular-nums hover:bg-accent"
      onClick={(e) => { e.stopPropagation(); onClick(pages[0]) }}
      title={`Found on page ${pages.join(', ')}`}
    >
      {label}
    </Badge>
  )
}
