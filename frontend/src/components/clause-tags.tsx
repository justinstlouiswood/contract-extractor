import { useState } from 'react'
import { Download, CheckCircle2, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { CLAUSE_LABELS, CLAUSE_LABELS_FULL, exportClauseSummary } from '@/lib/contract-utils'
import type { ClauseInfo } from '@/types/contract'

interface ClauseTagsProps {
  clauses?: Record<string, ClauseInfo>
  pageRefs?: Record<string, number[]>
  onScrollToPage?: (page: number) => void
  customerName?: string
}

const RISK_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  STANDARD: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Standard' },
  FAVORABLE: { bg: 'bg-success-bg', text: 'text-success-text', label: 'Favorable' },
  UNUSUAL: { bg: 'bg-danger-bg', text: 'text-danger-text', label: 'Unusual' },
}

export function ClauseTags({ clauses, pageRefs, onScrollToPage, customerName }: ClauseTagsProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)

  if (!clauses || Object.keys(clauses).length === 0) return null

  const entries = Object.entries(clauses)
  const presentCount = entries.filter(([, info]) => info.present).length
  const totalCount = entries.length
  const coveragePct = Math.round((presentCount / totalCount) * 100)
  const missingNames = entries
    .filter(([, info]) => !info.present)
    .map(([key]) => CLAUSE_LABELS_FULL[key] || key)

  if (presentCount === 0) {
    return (
      <div className="mt-3 px-1">
        <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-tint p-3">
          <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">No clauses detected in this contract.</span>
        </div>
      </div>
    )
  }

  const activeInfo = activeKey ? clauses[activeKey] : null
  const activePages = activeKey ? (pageRefs?.[`clause_${activeKey}`] ?? []) : []

  const handleTagClick = (key: string) => {
    if (activeKey === key) {
      setActiveKey(null)
      return
    }
    setActiveKey(key)
    const pages = pageRefs?.[`clause_${key}`] ?? []
    if (pages.length > 0 && onScrollToPage) {
      onScrollToPage(pages[0])
    }
  }

  return (
    <TooltipProvider>
      <div className="mt-3 space-y-2.5 px-1">
        {/* Header with export button */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Key Clauses</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => exportClauseSummary(clauses, pageRefs, customerName)}
            title="Export clause summary as CSV"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Coverage bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {presentCount} of {totalCount} detected
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{coveragePct}%</span>
          </div>
          <Progress value={coveragePct} className="h-1.5" />
          {missingNames.length > 0 && (
            <p className="text-[11px] text-muted-foreground/70">
              Missing: {missingNames.join(', ')}
            </p>
          )}
        </div>

        {/* Clause tags */}
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, info]) => {
            const isActive = activeKey === key
            if (info.present) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTagClick(key)}
                  className={`rounded-sm border px-2 py-1 text-xs transition-all ${
                    isActive
                      ? 'border-foreground/40 bg-moss/20 text-moss ring-1 ring-foreground/20'
                      : 'border-moss/30 bg-moss/15 text-moss hover:border-moss/50'
                  }`}
                >
                  <CheckCircle2 className="mr-1 inline h-3 w-3 text-success-text" />
                  {CLAUSE_LABELS[key] || key}
                </button>
              )
            }
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div className="cursor-default rounded-sm border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground/70">
                    <MinusCircle className="mr-1 inline h-3 w-3 text-danger-text" />
                    {CLAUSE_LABELS[key] || key}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-60 text-center">
                  No {CLAUSE_LABELS_FULL[key] || key} clause detected — consider flagging for review.
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {/* Expansion panel for active clause */}
        {activeKey && activeInfo && activeInfo.present && (
          <div className="rounded-sm border border-border bg-surface-tint p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">
                {CLAUSE_LABELS_FULL[activeKey] || activeKey}
              </span>
              {activeInfo.risk && RISK_STYLES[activeInfo.risk] && (
                <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${RISK_STYLES[activeInfo.risk].bg} ${RISK_STYLES[activeInfo.risk].text}`}>
                  {RISK_STYLES[activeInfo.risk].label}
                </span>
              )}
              {activePages.length > 0 && onScrollToPage && (
                <button
                  type="button"
                  onClick={() => onScrollToPage(activePages[0])}
                  className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground hover:bg-accent"
                >
                  p. {activePages.join(', ')}
                </button>
              )}
            </div>

            {activeInfo.description && (
              <p className="text-xs text-muted-foreground">{activeInfo.description}</p>
            )}

            {activeInfo.verbatim && (
              <div className="rounded-sm border border-border bg-card p-2">
                <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
                  &ldquo;{activeInfo.verbatim}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
