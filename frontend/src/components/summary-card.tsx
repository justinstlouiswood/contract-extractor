import { Copy, Mail, Lock, Table2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/contract-utils'
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

interface SummaryCardProps {
  parsed_data: ParsedData
  confidence?: Record<string, number>
  isUnlocked: boolean
  verifiedCount: number
  totalCategories: number
  activeAction: DistributionAction
  onAction: (action: DistributionAction) => void
  editedFields: Record<string, string>
  extractedInfo: string
  gmailAuth: GmailAuth
  onGmailAuthClick: () => void
  onSendEmail: (result: { success: boolean }) => void
}

export function SummaryCard({
  parsed_data, confidence,
  isUnlocked, verifiedCount, totalCategories, activeAction, onAction,
  editedFields, extractedInfo,
  gmailAuth, onGmailAuthClick, onSendEmail,
}: SummaryCardProps) {
  const currency = parsed_data.currency || 'CAD'
  const tcvNeedsReview = confidence?.total_contract_value !== undefined && confidence.total_contract_value < 85

  return (
    <Card>
      <CardContent className="p-5">
        {/* Contract summary */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums tracking-tighter">
            {parsed_data.total_contract_value && parsed_data.total_contract_value > 0
              ? formatCurrency(parsed_data.total_contract_value)
              : '\u2014'}
          </span>
          {parsed_data.total_contract_value && parsed_data.total_contract_value > 0 && (
            <span className="text-xs font-normal text-[#9494A8]">{currency}</span>
          )}
          {tcvNeedsReview && (
            <span className="ml-1 rounded-md border border-[#7F1D1D] bg-[#1F0D0D] px-1.5 py-0.5 text-xs font-medium text-[#F87171]">
              Review
            </span>
          )}
        </div>
        <div className="mt-1.5 text-base font-medium">{parsed_data.customer_name || 'Unknown Customer'}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          {parsed_data.duration && <span>{parsed_data.duration}</span>}
          {parsed_data.duration && parsed_data.subscription_start && <span>/</span>}
          {parsed_data.subscription_start && (
            <span>{parsed_data.subscription_start} - {parsed_data.subscription_end || '?'}</span>
          )}
        </div>

        {/* Distribution actions */}
        <div className="mt-4 border-t border-border pt-4">
          {isUnlocked ? (
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 gap-2.5 px-4 text-sm font-medium" onClick={() => onAction('copy' as DistributionAction)}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button
                variant={activeAction === 'email' ? 'default' : 'outline'}
                className="h-10 gap-2.5 px-4 text-sm font-medium"
                onClick={() => onAction(activeAction === 'email' ? null : 'email')}
              >
                <Mail className="h-4 w-4" /> Email
              </Button>
              <Button
                variant={activeAction === 'slack' ? 'default' : 'outline'}
                className="h-10 gap-2.5 px-4 text-sm font-medium"
                onClick={() => onAction(activeAction === 'slack' ? null : 'slack')}
              >
                <SlackIcon className="h-4 w-4" /> Slack
              </Button>
              <Button
                variant={activeAction === 'sheets' ? 'default' : 'outline'}
                className="h-10 gap-2.5 px-4 text-sm font-medium"
                onClick={() => onAction(activeAction === 'sheets' ? null : 'sheets')}
              >
                <Table2 className="h-4 w-4" /> Sheet
              </Button>
            </div>
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              disabled
            >
              <Lock className="h-3.5 w-3.5" />
              Verify {totalCategories - verifiedCount} of {totalCategories} categories to unlock
            </button>
          )}
        </div>

        {/* Conditional sub-panels */}
        {activeAction === 'email' && isUnlocked && (
          <div className="mt-3">
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
          <div className="mt-3">
            <SlackPanel parsed_data={parsed_data} onClose={() => onAction(null)} />
          </div>
        )}
        {activeAction === 'sheets' && isUnlocked && (
          <div className="mt-3">
            <SheetsPanel parsed_data={parsed_data} editedFields={editedFields} gmailAuth={gmailAuth} onAuthClick={onGmailAuthClick} onClose={() => onAction(null)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
