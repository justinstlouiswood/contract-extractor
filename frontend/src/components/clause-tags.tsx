import { CLAUSE_LABELS } from '@/lib/contract-utils'
import type { ClauseInfo } from '@/types/contract'

interface ClauseTagsProps {
  clauses?: Record<string, ClauseInfo>
}

export function ClauseTags({ clauses }: ClauseTagsProps) {
  if (!clauses || Object.keys(clauses).length === 0) return null

  const entries = Object.entries(clauses)
  const presentCount = entries.filter(([, info]) => info.present).length

  return (
    <div className="mt-3 space-y-2 px-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Key Clauses</span>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {presentCount} of {entries.length} detected
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, info]) => (
          <div
            key={key}
            title={info.description || undefined}
            className={`rounded-sm border px-2.5 py-1.5 text-xs transition-colors ${
              info.present
                ? 'border-moss/30 bg-moss/15 text-moss'
                : 'border-border bg-transparent text-muted-foreground/70'
            }`}
          >
            {info.present ? (
              <span className="text-[#4ADE80]">+</span>
            ) : (
              <span className="text-[#F87171]">{'\u2212'}</span>
            )}{' '}
            {CLAUSE_LABELS[key] || key}
          </div>
        ))}
      </div>
    </div>
  )
}
