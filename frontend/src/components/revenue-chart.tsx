import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/contract-utils'
import type { AnnualFee } from '@/types/contract'

interface RevenueChartProps {
  annualFees: AnnualFee[]
  onboardingFee?: number
  currency?: string
}

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)']

export function RevenueChart({ annualFees, currency }: RevenueChartProps) {
  const fees = (annualFees || []).filter((f) => f.amount > 0)
  const total = fees.reduce((acc, f) => acc + f.amount, 0)
  const [animated, setAnimated] = useState(false)

  const feeKey = fees.map((f) => `${f.year}:${f.amount}`).join('|')

  useEffect(() => {
    setAnimated(false)
    const t = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(t)
  }, [feeKey])

  if (fees.length === 0 || total === 0) return null

  return (
    <div className="chart-section">
      <div className="mb-[10px] flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-text-muted">
          Annual Fee Breakdown
        </span>
        <span className="text-[12px] font-semibold text-text tabular-nums">
          {formatCurrency(total)}{' '}
          <span className="text-[11px] font-normal text-text-muted">{currency}</span>
        </span>
      </div>

      <div
        className="relative flex h-[22px] overflow-hidden rounded-[5px] border border-border-subtle bg-bg-muted"
        style={{
          width: animated ? '100%' : '0%',
          transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {fees.map((fee, i) => {
          const pct = (fee.amount / total) * 100
          const color = COLORS[i % COLORS.length]
          return (
            <div
              key={`${fee.year}-${i}`}
              title={`Year ${fee.year}: ${formatCurrency(fee.amount)} (${pct.toFixed(1)}%)`}
              className="relative flex h-full items-center justify-center"
              style={{
                width: `${pct}%`,
                background: color,
                borderRight: i < fees.length - 1 ? '1px solid rgba(255,255,255,0.18)' : 'none',
                opacity: animated ? 1 : 0,
                transition: 'opacity 400ms',
                transitionDelay: `${i * 120 + 200}ms`,
              }}
            >
              {pct > 14 && (
                <span className="text-[10px] font-semibold tracking-[0.02em] text-white/90">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-[14px] flex flex-wrap gap-[18px]">
        {fees.map((fee, i) => {
          const pct = (fee.amount / total) * 100
          const color = COLORS[i % COLORS.length]
          return (
            <div key={`legend-${fee.year}-${i}`} className="flex items-center gap-2">
              <div
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: color }}
              />
              <div className="flex flex-col gap-[1px]">
                <span className="text-[10px] uppercase tracking-[0.02em] text-text-muted">
                  Year {fee.year}
                </span>
                <span className="text-[12px] font-semibold text-text tabular-nums">
                  {formatCurrency(fee.amount)}{' '}
                  <span className="text-[10px] font-medium text-text-muted">
                    · {pct.toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
