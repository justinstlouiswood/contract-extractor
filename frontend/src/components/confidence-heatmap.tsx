import { useMemo } from 'react'
import { getHeatmapColor, getConfidenceFieldLabel } from '@/lib/contract-utils'
import type { ParsedData } from '@/types/contract'

interface ConfidenceHeatmapProps {
  parsed_data: ParsedData
}

interface TierGroup {
  label: string
  entries: [string, number][]
}

export function ConfidenceHeatmap({ parsed_data }: ConfidenceHeatmapProps) {
  const confidence = parsed_data.confidence
  if (!confidence || Object.keys(confidence).length === 0) return null

  const { tiers, avg } = useMemo(() => {
    const entries = Object.entries(confidence!)
      .filter(([, score]) => typeof score === 'number' && score > 0)
      .sort((a, b) => b[1] - a[1])

    if (entries.length === 0) return { tiers: [], avg: 0 }

    const avgScore = Math.round(entries.reduce((sum, [, s]) => sum + s, 0) / entries.length)

    const high = entries.filter(([, s]) => s >= 85)
    const review = entries.filter(([, s]) => s < 85)

    const groups: TierGroup[] = []
    if (high.length > 0) groups.push({ label: 'High Confidence', entries: high })
    if (review.length > 0) groups.push({ label: 'Needs Review', entries: review })

    return { tiers: groups, avg: avgScore }
  }, [confidence])

  if (tiers.length === 0) return null

  return (
    <div className="rounded-sm border border-border bg-card p-2.5 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Extraction Confidence</span>
        <span className="text-xs text-muted-foreground">avg {avg}%</span>
      </div>

      <div className="space-y-2">
        {tiers.map((tier, tierIdx) => (
          <div key={tier.label} className={tierIdx > 0 ? 'border-t border-border pt-2' : ''}>
            <div className="mb-1 text-xs font-medium text-foreground">
              {tier.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tier.entries.map(([key, score]) => (
                <div
                  key={key}
                  className="flex items-center gap-1 rounded-sm px-2 py-1"
                  style={{ backgroundColor: getHeatmapColor(score) }}
                  title={`${getConfidenceFieldLabel(key)}: ${score}%`}
                >
                  <span className="text-xs text-muted-foreground">{getConfidenceFieldLabel(key)}</span>
                  <span className="text-xs tabular-nums text-foreground">{score}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
