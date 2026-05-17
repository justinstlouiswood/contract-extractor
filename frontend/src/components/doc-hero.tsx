import { Calendar, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/contract-utils'
import type { ParsedData } from '@/types/contract'

interface DocHeroProps {
  parsed_data: ParsedData
  verifiedCount: number
  totalCategories: number
  onMarkAllVerified: () => void
}

export function DocHero({ parsed_data, verifiedCount, totalCategories, onMarkAllVerified }: DocHeroProps) {
  const customer = parsed_data.customer_name || 'Unknown Customer'
  const tcv = parsed_data.total_contract_value || 0
  const currency = parsed_data.currency || ''
  const start = parsed_data.subscription_start
  const end = parsed_data.subscription_end
  const dateRange =
    start && end ? `${start} – ${end}` : start || end || null
  const duration = parsed_data.duration

  const allVerified = totalCategories > 0 && verifiedCount === totalCategories
  const verifyPct = totalCategories === 0 ? 0 : (verifiedCount / totalCategories) * 100

  const statusBadge = allVerified ? (
    <span className="badge badge-approved">Approved</span>
  ) : verifiedCount > 0 ? (
    <span className="badge badge-pending">In Review</span>
  ) : (
    <span className="badge badge-review">Review</span>
  )

  const remaining = Math.max(totalCategories - verifiedCount, 0)

  return (
    <div className="doc-hero">
      <div className="doc-hero-top">
        <div className="doc-hero-left">
          <span className="doc-title">{customer}</span>
          {tcv > 0 && (
            <span className="doc-tcv tabular-nums">
              {formatCurrency(tcv)}
              {currency && <span className="doc-currency">{currency}</span>}
            </span>
          )}
          {statusBadge}
          <span className="badge badge-neutral">MSA</span>
        </div>
        {(dateRange || duration) && (
          <div className="doc-meta-right">
            <Calendar size={12} strokeWidth={1.5} />
            <span>
              {dateRange}
              {duration && dateRange ? ` · ${duration}` : duration}
            </span>
          </div>
        )}
      </div>

      <div className="verify-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${verifyPct}%` }} />
        </div>
        <span className="verify-label tabular-nums">
          {verifiedCount} / {totalCategories} verified
        </span>
        <button
          type="button"
          className="verify-action"
          onClick={onMarkAllVerified}
          disabled={allVerified || totalCategories === 0}
        >
          <CheckCircle size={11} strokeWidth={1.5} />
          {allVerified
            ? 'All verified'
            : `Verify ${remaining} of ${totalCategories} to unlock`}
        </button>
      </div>
    </div>
  )
}
