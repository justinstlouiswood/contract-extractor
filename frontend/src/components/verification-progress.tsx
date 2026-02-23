import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

interface VerificationProgressProps {
  verified: number
  total: number
  onMarkAll: () => void
}

export function VerificationProgress({ verified, total, onMarkAll }: VerificationProgressProps) {
  const pct = total > 0 ? (verified / total) * 100 : 0

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-card p-2.5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          <span className="tabular-nums">{verified} / {total}</span> categories verified
        </span>
        {verified >= 1 && verified < total && (
          <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={onMarkAll}>
            Mark All
          </Button>
        )}
        {pct >= 100 && (
          <span className="text-xs font-medium text-foreground">All verified</span>
        )}
      </div>
      <Progress value={pct} className="h-2" />
      <span className="text-xs text-muted-alt">
        {verified} of {total} verified
      </span>
    </div>
  )
}
