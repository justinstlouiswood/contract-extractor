import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { parseContractDate, formatShortDate } from '@/lib/contract-utils'
import type { ParsedData } from '@/types/contract'

interface ContractTimelineProps {
  parsed_data: ParsedData
}

export function ContractTimeline({ parsed_data }: ContractTimelineProps) {
  const timeline = useMemo(() => {
    const start = parseContractDate(parsed_data.subscription_start)
    const end = parseContractDate(parsed_data.subscription_end)
    if (!start || !end || end <= start) return null

    const totalMs = end.getTime() - start.getTime()
    const now = new Date()
    const nowMs = now.getTime() - start.getTime()
    const todayPct = Math.max(0, Math.min(100, (nowMs / totalMs) * 100))
    const isActive = now >= start && now <= end

    const custSigDate = parseContractDate(parsed_data.signatures?.customer?.date)
    const vendSigDate = parseContractDate(parsed_data.signatures?.vendor?.date)
    const sigDate = custSigDate && vendSigDate
      ? (custSigDate < vendSigDate ? custSigDate : vendSigDate)
      : custSigDate || vendSigDate
    let sigPct: number | null = null
    if (sigDate && sigDate >= start && sigDate <= end) {
      sigPct = ((sigDate.getTime() - start.getTime()) / totalMs) * 100
    }

    return { start, end, todayPct, isActive, sigPct }
  }, [parsed_data])

  if (!timeline) return null

  const { start, end, todayPct, isActive, sigPct } = timeline

  return (
    <div className="rounded-sm border border-border bg-card p-2.5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Contract Timeline</span>
        <div className="flex items-center gap-2">
          {!isActive && new Date() > end && (
            <Badge variant="review" className="text-xs">Expired</Badge>
          )}
          <span className="text-xs text-muted-foreground">{parsed_data.duration || ''}</span>
        </div>
      </div>

      {/* Timeline track */}
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 h-1 rounded bg-secondary" />
        <div className="absolute inset-x-0 top-2 h-1 rounded bg-moss/30" />

        {isActive && (
          <div
            className="absolute top-2 left-0 h-1 rounded bg-moss/60"
            style={{ width: `${todayPct}%` }}
          />
        )}

        {sigPct !== null && (
          <div
            className="absolute top-0 h-5 w-px bg-sage/60"
            style={{ left: `${sigPct}%` }}
          >
            <div className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-xs text-sage">
              Signed
            </div>
          </div>
        )}

        {isActive && (
          <div
            className="absolute top-0 h-5 w-0.5 rounded bg-foreground"
            style={{ left: `${todayPct}%` }}
          >
            <div className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-foreground">
              Today
            </div>
          </div>
        )}
      </div>

      {/* Date labels with tick marks */}
      <div className="mt-1 flex justify-between">
        <div className="flex flex-col items-start">
          <div className="h-1.5 w-px bg-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">{formatShortDate(start)}</span>
        </div>
        <div className="flex flex-col items-end">
          <div className="h-1.5 w-px bg-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">{formatShortDate(end)}</span>
        </div>
      </div>
    </div>
  )
}
