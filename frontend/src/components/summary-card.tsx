import { useState, useMemo } from 'react'
import { Copy, Mail, Lock, Table2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatCurrency, getHeatmapColor, getConfidenceFieldLabel, buildClipboardSummary, stripSourceTags } from '@/lib/contract-utils'
import { EmailSection } from '@/components/distribution/email-section'
import { SlackPanel } from '@/components/distribution/slack-panel'
import { SheetsPanel } from '@/components/distribution/sheets-panel'
import type { ParsedData, GmailAuth, DistributionAction } from '@/types/contract'

// Slack icon as inline SVG since lucide-react doesn't include brand icons
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="13" y="2" width="3" height="8" rx="1.5" />
      <path d="M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5" />
      <rect x="8" y="14" width="3" height="8" rx="1.5" />
      <path d="M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5" />
      <rect x="14" y="13" width="8" height="3" rx="1.5" />
      <path d="M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5" />
      <rect x="2" y="8" width="8" height="3" rx="1.5" />
      <path d="M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5" />
    </svg>
  )
}

function getAvgColor(s: number): string {
  if (s >= 85) return 'text-success-text'
  if (s >= 70) return 'text-caution-text'
  return 'text-danger-text'
}

interface TierGroup {
  label: string
  entries: [string, number][]
}

interface SummaryCardProps {
  parsed_data: ParsedData
  confidence?: Record<string, number>
  isUnlocked: boolean
  verifiedCount: number
  totalCategories: number
  activeAction: DistributionAction
  onAction: (action: DistributionAction) => void
  onMarkAll: () => void
  editedFields: Record<string, string>
  extractedInfo: string
  gmailAuth: GmailAuth
  onGmailAuthClick: () => void
  onSendEmail: (result: { success: boolean }) => void
  onCopyFeedback: (message: string) => void
}

export function SummaryCard({
  parsed_data, confidence,
  isUnlocked, verifiedCount, totalCategories, activeAction, onAction, onMarkAll,
  editedFields, extractedInfo,
  gmailAuth, onGmailAuthClick, onSendEmail, onCopyFeedback,
}: SummaryCardProps) {
  const [confidenceOpen, setConfidenceOpen] = useState(false)
  const [copyExpanded, setCopyExpanded] = useState(false)

  const currency = parsed_data.currency || 'CAD'
  const tcvNeedsReview = confidence?.total_contract_value !== undefined && confidence.total_contract_value < 85
  const verifyPct = totalCategories > 0 ? (verifiedCount / totalCategories) * 100 : 0

  // Build date range string
  const dateRange = [parsed_data.subscription_start, parsed_data.subscription_end]
    .filter(Boolean)
    .join(' \u2013 ')

  // Compute confidence tiers
  const { tiers, avg } = useMemo(() => {
    if (!confidence || Object.keys(confidence).length === 0) return { tiers: [] as TierGroup[], avg: 0 }

    const entries = Object.entries(confidence)
      .filter(([, score]) => typeof score === 'number' && score > 0)
      .sort((a, b) => b[1] - a[1])

    if (entries.length === 0) return { tiers: [] as TierGroup[], avg: 0 }

    const avgScore = Math.round(entries.reduce((sum, [, s]) => sum + s, 0) / entries.length)

    const high = entries.filter(([, s]) => s >= 85)
    const review = entries.filter(([, s]) => s < 85)

    const groups: TierGroup[] = []
    if (high.length > 0) groups.push({ label: 'High Confidence', entries: high })
    if (review.length > 0) groups.push({ label: 'Needs Review', entries: review })

    return { tiers: groups, avg: avgScore }
  }, [confidence])

  async function handleCopy(mode: 'condensed' | 'full') {
    const text = mode === 'condensed'
      ? buildClipboardSummary(parsed_data, editedFields)
      : stripSourceTags(extractedInfo)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    onCopyFeedback(mode === 'condensed' ? 'Condensed summary copied' : 'Full text copied')
    setCopyExpanded(false)
  }

  return (
    <Card>
      <CardContent className="p-3">
        {/* Row 1: Company, value, badge, dates */}
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{parsed_data.customer_name || 'Unknown Customer'}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {parsed_data.total_contract_value && parsed_data.total_contract_value > 0
              ? formatCurrency(parsed_data.total_contract_value)
              : '\u2014'}
          </span>
          {parsed_data.total_contract_value && parsed_data.total_contract_value > 0 && (
            <span className="text-xs text-muted-alt">{currency}</span>
          )}
          {tcvNeedsReview && (
            <Badge variant="review" className="text-xs">Review</Badge>
          )}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {dateRange}
            {parsed_data.duration && dateRange && ` \u00B7 ${parsed_data.duration}`}
            {parsed_data.duration && !dateRange && parsed_data.duration}
          </span>
        </div>

        {/* Row 2: Verification progress + lock/unlock */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Progress value={verifyPct} className="h-1.5 flex-1" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {verifiedCount} / {totalCategories} verified
            </span>
          </div>
          {isUnlocked ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {copyExpanded ? (
                <>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => { handleCopy('condensed'); }}>
                    Condensed
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => { handleCopy('full'); }}>
                    Full Text
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setCopyExpanded(true)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              )}
              <Button
                variant={activeAction === 'email' ? 'default' : 'outline'}
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => onAction(activeAction === 'email' ? null : 'email')}
              >
                <Mail className="h-3 w-3" /> Email
              </Button>
              <Button
                variant={activeAction === 'slack' ? 'default' : 'outline'}
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => onAction(activeAction === 'slack' ? null : 'slack')}
              >
                <SlackIcon className="h-3 w-3" /> Slack
              </Button>
              <Button
                variant={activeAction === 'sheets' ? 'default' : 'outline'}
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => onAction(activeAction === 'sheets' ? null : 'sheets')}
              >
                <Table2 className="h-3 w-3" /> Sheet
              </Button>
            </div>
          ) : (
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
              onClick={onMarkAll}
            >
              <Lock className="h-3 w-3" />
              Verify {totalCategories - verifiedCount} of {totalCategories} to unlock
            </button>
          )}
        </div>

        {/* Accordion: Extraction Confidence */}
        {tiers.length > 0 && (
          <Collapsible open={confidenceOpen} onOpenChange={setConfidenceOpen}>
            <div className="mt-2 border-t border-border pt-2">
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-left text-xs hover:text-foreground/80">
                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${confidenceOpen ? 'rotate-90' : ''}`} />
                <span className="font-semibold text-foreground">Extraction Confidence</span>
                <span className="mx-1 text-border">|</span>
                <span className={`tabular-nums ${getAvgColor(avg)}`}>avg {avg}%</span>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mt-1.5 space-y-2">
                {tiers.map((tier, tierIdx) => (
                  <div key={tier.label} className={tierIdx > 0 ? 'border-t border-border pt-2' : ''}>
                    <div className="mb-1 text-xs font-medium text-foreground">
                      {tier.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tier.entries.map(([key, score]) => (
                        <div
                          key={key}
                          className="flex items-center gap-1 rounded-sm px-2 py-1"
                          style={{ backgroundColor: getHeatmapColor(score) }}
                          title={`${getConfidenceFieldLabel(key)}: ${score}%`}
                        >
                          <span className="text-xs text-muted-foreground">{getConfidenceFieldLabel(key)}</span>
                          <span className="text-xs tabular-nums text-foreground">{score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Conditional distribution sub-panels */}
        {activeAction === 'email' && isUnlocked && (
          <div className="mt-3 border-t border-border pt-3">
            <EmailSection
              contractData={parsed_data}
              extractedInfo={extractedInfo}
              gmailAuth={gmailAuth}
              onAuthClick={onGmailAuthClick}
              onSendEmail={onSendEmail}
              onClose={() => onAction(null)}
            />
          </div>
        )}
        {activeAction === 'slack' && isUnlocked && (
          <div className="mt-3 border-t border-border pt-3">
            <SlackPanel parsed_data={parsed_data} onClose={() => onAction(null)} />
          </div>
        )}
        {activeAction === 'sheets' && isUnlocked && (
          <div className="mt-3 border-t border-border pt-3">
            <SheetsPanel parsed_data={parsed_data} editedFields={editedFields} gmailAuth={gmailAuth} onAuthClick={onGmailAuthClick} onClose={() => onAction(null)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
