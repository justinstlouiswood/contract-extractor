import { useMemo } from 'react'
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { formatCurrency } from '@/lib/contract-utils'
import type { AnnualFee } from '@/types/contract'

interface RevenueChartProps {
  annualFees: AnnualFee[]
  onboardingFee?: number
  currency?: string
}

interface TooltipPayloadEntry {
  name?: string
  value?: number
  dataKey?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-float">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {payload.map((entry: TooltipPayloadEntry, idx: number) => (
        <p key={idx} className="text-sm text-muted-foreground">
          {entry.name}: {formatCurrency(entry.value || 0)}
        </p>
      ))}
    </div>
  )
}

// Custom label to show escalation % above each bar with anchor line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EscalationLabel(props: any) {
  const { x, y, width, index, data } = props
  if (index === 0 || !data || !data[index] || !data[index - 1]) return null
  const prev = data[index - 1].annual
  const curr = data[index].annual
  if (!prev || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  if (pct === 0) return null

  const cx = x + (width || 0) / 2

  return (
    <g>
      <line
        x1={cx}
        y1={y - 10}
        x2={cx}
        y2={y}
        className="stroke-muted-foreground"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={y - 18}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
      >
        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
      </text>
    </g>
  )
}

function useChartColors() {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    const moss = style.getPropertyValue('--moss').trim()
    const sage = style.getPropertyValue('--sage').trim()
    return {
      mossColor: moss,
      sageColor: sage,
      mossFill: moss,
      sageFill: sage,
      cumulativeColor: '#5EAFC0',
    }
  }, [])
}

export function RevenueChart({ annualFees, onboardingFee, currency = 'CAD' }: RevenueChartProps) {
  if (!annualFees || annualFees.length === 0) return null

  const { mossColor, mossFill, sageFill, cumulativeColor } = useChartColors()

  let cumulative = onboardingFee && onboardingFee > 0 ? onboardingFee : 0
  const data = annualFees.map((fee, i) => {
    cumulative += fee.amount
    return {
      name: `Year ${fee.year}`,
      annual: fee.amount,
      onboarding: i === 0 && onboardingFee && onboardingFee > 0 ? onboardingFee : 0,
      cumulative,
    }
  })

  const hasOnboarding = onboardingFee && onboardingFee > 0

  return (
    <div className="mt-3 space-y-2 px-1">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-moss" />
          <span className="text-xs text-muted-foreground">Annual Fee</span>
        </div>
        {hasOnboarding && (
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-sage" />
            <span className="text-xs text-muted-foreground">Onboarding</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-px w-4 border-t border-dashed" style={{ borderColor: '#5EAFC0' }} />
          <span className="text-xs text-muted-foreground">Cumulative TCV</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-foreground"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => '$' + v.toLocaleString()}
              className="fill-foreground"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => '$' + (v / 1000).toFixed(0) + 'k'}
              className="fill-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="annual"
              name={`Annual Fee (${currency})`}
              fill={mossFill}
              stroke={mossColor}
              strokeWidth={1}
              radius={[2, 2, 0, 0]}
              label={<EscalationLabel data={data} />}
            />
            {hasOnboarding && (
              <Bar
                yAxisId="left"
                dataKey="onboarding"
                name={`Onboarding (${currency})`}
                fill={sageFill}
                stroke={mossColor}
                strokeWidth={1}
                radius={[2, 2, 0, 0]}
              />
            )}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              name={`Cumulative TCV (${currency})`}
              stroke={cumulativeColor}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: cumulativeColor, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
