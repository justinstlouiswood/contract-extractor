import { useMemo } from 'react'
import { formatCurrency, parseContractDate, formatShortDate } from '@/lib/contract-utils'
import type { ParsedData } from '@/types/contract'

interface PaymentEvent {
  label: string
  amount: number
  date: Date
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
      })
    }

    if (parsed_data.annual_fees && parsed_data.annual_fees.length > 0) {
      parsed_data.annual_fees.forEach((fee) => {
        const feeDate = new Date(startDate)
        feeDate.setFullYear(feeDate.getFullYear() + (fee.year - 1))
        items.push({
          label: `Year ${fee.year}`,
          amount: fee.amount,
          date: feeDate,
        })
      })
    }

    return items.length > 0 ? items : null
  }, [parsed_data])

  if (!events) return null

  return (
    <div className="payment-schedule">
      <div className="payment-title">Payment Schedule</div>

      <div className="timeline-wrap">
        <div className="timeline-line" />
        <div className="timeline-events">
          {events.map((evt, i) => (
            <div key={i} className="timeline-event">
              <div className="timeline-square" />
              <div className="timeline-label tabular-nums">{formatCurrency(evt.amount)}</div>
              <div className="timeline-sub">{evt.label}</div>
              <div className="timeline-date">{formatShortDate(evt.date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
