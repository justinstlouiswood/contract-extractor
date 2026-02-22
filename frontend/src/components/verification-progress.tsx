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
    <div className="flex flex-col gap-2.5 rounded-sm border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          <span className="tabular-nums">{verified} / {total}</span> categories verified
        </span>
        {verified >= 1 && verified < total && (
          <Button variant="ghost" size="sm" className="h-8 px-3 text-sm" onClick={onMarkAll}>
            Mark All
          </Button>
        )}
        {pct >= 100 && (
          <span className="text-sm font-medium text-foreground">All verified</span>
        )}
      </div>
      <Progress value={pct} className="h-2.5" />
      <span className="text-xs text-muted-alt">
        {verified} of {total} verified
      </span>
    </div>
  )
}
