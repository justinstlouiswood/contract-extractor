import { useState } from 'react'
import { Copy, Lock, Mail, Table2 } from 'lucide-react'
import { EmailSection } from '@/components/distribution/email-section'
import { SlackPanel } from '@/components/distribution/slack-panel'
import { SheetsPanel } from '@/components/distribution/sheets-panel'
import { buildClipboardSummary, stripSourceTags } from '@/lib/contract-utils'
import type { DistributionAction, GmailAuth, ParsedData } from '@/types/contract'

function SlackIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

interface DistributionCardProps {
  parsed_data: ParsedData
  extractedInfo: string
  editedFields: Record<string, string>
  isUnlocked: boolean
  verifiedCount: number
  totalCategories: number
  activeAction: DistributionAction
  onAction: (action: DistributionAction) => void
  onMarkAllVerified: () => void
  gmailAuth: GmailAuth
  onGmailAuthClick: () => void
  onSendEmail: (result: { success: boolean }) => void
  onCopyFeedback: (message: string) => void
}

export function DistributionCard({
  parsed_data,
  extractedInfo,
  editedFields,
  isUnlocked,
  verifiedCount,
  totalCategories,
  activeAction,
  onAction,
  onMarkAllVerified,
  gmailAuth,
  onGmailAuthClick,
  onSendEmail,
  onCopyFeedback,
}: DistributionCardProps) {
  const [copyExpanded, setCopyExpanded] = useState(false)
  const remaining = Math.max(totalCategories - verifiedCount, 0)

  async function handleCopy(mode: 'condensed' | 'full') {
    const text =
      mode === 'condensed'
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
    <div className="dist-card">
      <div className={`dist-row${isUnlocked ? '' : ' dist-locked'}`}>
        {copyExpanded && isUnlocked ? (
          <>
            <button
              type="button"
              className="dist-btn"
              onClick={() => handleCopy('condensed')}
            >
              <Copy size={13} strokeWidth={1.5} />
              Condensed
            </button>
            <button
              type="button"
              className="dist-btn"
              onClick={() => handleCopy('full')}
            >
              <Copy size={13} strokeWidth={1.5} />
              Full Text
            </button>
            <button
              type="button"
              className="dist-btn"
              onClick={() => setCopyExpanded(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="dist-btn"
              onClick={() => isUnlocked && setCopyExpanded(true)}
              disabled={!isUnlocked}
            >
              <Copy size={13} strokeWidth={1.5} />
              Copy
            </button>
            <button
              type="button"
              className={`dist-btn${activeAction === 'email' ? ' active' : ''}`}
              onClick={() => isUnlocked && onAction(activeAction === 'email' ? null : 'email')}
              disabled={!isUnlocked}
            >
              <Mail size={13} strokeWidth={1.5} />
              Email
            </button>
            <button
              type="button"
              className={`dist-btn${activeAction === 'slack' ? ' active' : ''}`}
              onClick={() => isUnlocked && onAction(activeAction === 'slack' ? null : 'slack')}
              disabled={!isUnlocked}
            >
              <SlackIcon size={13} />
              Slack
            </button>
            <button
              type="button"
              className={`dist-btn${activeAction === 'sheets' ? ' active' : ''}`}
              onClick={() => isUnlocked && onAction(activeAction === 'sheets' ? null : 'sheets')}
              disabled={!isUnlocked}
            >
              <Table2 size={13} strokeWidth={1.5} />
              Sheet
            </button>
          </>
        )}
      </div>

      {!isUnlocked && (
        <button
          type="button"
          className="dist-unlock-link"
          onClick={onMarkAllVerified}
        >
          <Lock size={11} strokeWidth={1.5} />
          Verify {remaining} of {totalCategories} to unlock
        </button>
      )}

      {isUnlocked && activeAction === 'email' && (
        <div className="dist-panel">
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
      {isUnlocked && activeAction === 'slack' && (
        <div className="dist-panel">
          <SlackPanel parsed_data={parsed_data} onClose={() => onAction(null)} />
        </div>
      )}
      {isUnlocked && activeAction === 'sheets' && (
        <div className="dist-panel">
          <SheetsPanel
            parsed_data={parsed_data}
            editedFields={editedFields}
            gmailAuth={gmailAuth}
            onAuthClick={onGmailAuthClick}
            onClose={() => onAction(null)}
          />
        </div>
      )}
    </div>
  )
}
