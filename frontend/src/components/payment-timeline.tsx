import { useMemo } from 'react'
import { formatCurrency, parseContractDate, formatShortDate } from '@/lib/contract-utils'
import type { ParsedData } from '@/types/contract'

interface PaymentEvent {
  label: string
  amount: number
  date: Date
  type: 'onboarding' | 'annual'
}

interface PaymentTimelineProps {
  parsed_data: ParsedData
}

export function PaymentTimeline({ parsed_data }: PaymentTimelineProps) {
  const events = useMemo(() => {
    const startDate = parseContractDate(parsed_data.subscription_start)
    if (!startDate) return null

    const items: PaymentEvent[] = []

    if (parsed_data.onboarding_fee && parsed_data.onboarding_fee > 0) {
      items.push({
        label: 'Onboarding',
        amount: parsed_data.onboarding_fee,
        date: startDate,
        type: 'onboarding',
      })
    }

    if (parsed_data.annual_fees && parsed_data.annual_fees.length > 0) {
      parsed_data.annual_fees.forEach(fee => {
        const feeDate = new Date(startDate)
        feeDate.setFullYear(feeDate.getFullYear() + (fee.year - 1))
        items.push({
          label: `Year ${fee.year}`,
          amount: fee.amount,
          date: feeDate,
          type: 'annual',
        })
      })
    }

    return items.length > 0 ? items : null
  }, [parsed_data])

  if (!events) return null

  return (
    <div className="mt-3 space-y-2 px-1">
      <div className="text-xs font-semibold text-muted-foreground">Payment Schedule</div>

      <div className="relative">
        {/* Baseline rule — vertically centered on the dot row */}
        <div className="relative flex items-center">
          <div className="absolute left-4 right-4 h-px bg-border" />

          <div className="relative flex w-full justify-between">
            {events.map((evt, i) => (
              <div key={i} className="flex flex-col items-center">
                {/* Dot — centered on the baseline */}
                <div
                  className={`h-2 w-2 rounded-full ${
                    evt.type === 'onboarding'
                      ? 'border-2 border-moss bg-transparent'
                      : 'bg-moss'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Labels row — positioned directly below the dot row */}
        <div className="mt-1.5 flex w-full justify-between">
          {events.map((evt, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-xs tabular-nums text-foreground">
                {formatCurrency(evt.amount)}
              </span>
              <span className="text-xs text-muted-foreground">
                {evt.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatShortDate(evt.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
