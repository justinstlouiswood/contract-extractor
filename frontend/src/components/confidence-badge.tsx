import { Badge } from '@/components/ui/badge'
import { getConfidenceLevel, getConfidenceLabel } from '@/lib/contract-utils'

interface ConfidenceBadgeProps {
  score: number | null | undefined
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  if (score === undefined || score === null) return null
  const level = getConfidenceLevel(score)
  const variant = level === 'high' ? 'success' : 'danger'

  return (
    <Badge
      variant={variant}
      className="text-xs tabular-nums"
      title={getConfidenceLabel(score)}
    >
      {score}%
    </Badge>
  )
}
