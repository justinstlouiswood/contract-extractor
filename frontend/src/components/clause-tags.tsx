import { Download } from 'lucide-react'
import { CLAUSE_LABELS, CLAUSE_LABELS_FULL, exportClauseSummary } from '@/lib/contract-utils'
import type { ClauseInfo } from '@/types/contract'

interface ClauseTagsProps {
  clauses?: Record<string, ClauseInfo>
  pageRefs?: Record<string, number[]>
  onScrollToPage?: (page: number) => void
  customerName?: string
}

export function ClauseTags({ clauses, pageRefs, onScrollToPage, customerName }: ClauseTagsProps) {
  if (!clauses || Object.keys(clauses).length === 0) return null

  const entries = Object.entries(clauses)
  const presentCount = entries.filter(([, info]) => info.present).length
  const totalCount = entries.length
  const coveragePct = Math.round((presentCount / totalCount) * 100)
  const missingNames = entries
    .filter(([, info]) => !info.present)
    .map(([key]) => CLAUSE_LABELS_FULL[key] || key)

  const handleTagClick = (key: string) => {
    if (!onScrollToPage) return
    const pages = pageRefs?.[`clause_${key}`] ?? []
    if (pages.length > 0) onScrollToPage(pages[0])
  }

  return (
    <div className="clauses-section">
      <div className="clauses-row">
        <span className="clauses-title">Key Clauses</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => exportClauseSummary(clauses, pageRefs, customerName)}
          title="Export clause summary as CSV"
          aria-label="Export clauses"
        >
          <Download size={12} strokeWidth={1.5} />
        </button>
      </div>

      <div className="clauses-progress">
        <div className="clauses-bar-track">
          <div className="clauses-bar-fill" style={{ width: `${coveragePct}%` }} />
        </div>
        <span className="clauses-pct">{coveragePct}%</span>
      </div>

      {missingNames.length > 0 && (
        <div className="clauses-missing">
          Missing: {missingNames.join(', ')}
        </div>
      )}

      <div className="clauses-tags">
        {entries.map(([key, info]) => {
          const label = CLAUSE_LABELS[key] || key
          return (
            <span
              key={key}
              className={`clause-tag${info.present ? '' : ' missing'}`}
              onClick={() => info.present && handleTagClick(key)}
              role={info.present ? 'button' : undefined}
              title={info.description || (info.present ? label : `${label} not detected`)}
            >
              {info.present ? '+ ' : '− '}
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
