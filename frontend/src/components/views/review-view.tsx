import { useState, useMemo } from 'react'
import { SummaryCard } from '@/components/summary-card'
import { ContractTimeline } from '@/components/contract-timeline'
import { VerificationProgress } from '@/components/verification-progress'
import { ConfidenceHeatmap } from '@/components/confidence-heatmap'
import { ExpandableSection } from '@/components/expandable-section'
import { ReviewFieldTable } from '@/components/review-field-table'
import { RevenueChart } from '@/components/revenue-chart'
import { PaymentTimeline } from '@/components/payment-timeline'
import { ClauseTags } from '@/components/clause-tags'
import { ExtractedTextDisplay } from '@/components/extracted-text-display'
import { getVerifiableFields, getPageRef, buildClipboardSummary } from '@/lib/contract-utils'
import type { ContractResult, GmailAuth, DistributionAction, VerificationCategory } from '@/types/contract'

interface ReviewViewProps {
  data: ContractResult
  pdfId: string | null
  gmailAuth: GmailAuth
  onGmailAuthClick: () => void
  onSendEmail: (result: { success: boolean }) => void
  onScrollToPage: (page: number) => void
  onCopyFeedback: (message: string) => void
}

export function ReviewView({ data, gmailAuth, onGmailAuthClick, onSendEmail, onScrollToPage, onCopyFeedback }: ReviewViewProps) {
  const parsed_data = data.parsed_data

  const [verifiedCategories, setVerifiedCategories] = useState(new Set<VerificationCategory>())
  const [activeField, setActiveField] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState(new Set(['contract_details', 'fees_revenue']))
  const [distributionAction, setDistributionAction] = useState<DistributionAction>(null)

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editedFields, setEditedFields] = useState<Record<string, string>>({})

  const [showSourceTags, setShowSourceTags] = useState(true)

  const verifiableFields = useMemo(() => getVerifiableFields(parsed_data), [parsed_data])

  const contractFields = verifiableFields.filter(f => f.section === 'contract_details')
  const feeFields = verifiableFields.filter(f => f.section === 'fees_revenue')
  const sigFields = verifiableFields.filter(f => f.section === 'signatures')

  const availableCategories = useMemo(() => {
    const cats: VerificationCategory[] = []
    if (contractFields.length > 0) cats.push('contract_details')
    if (feeFields.length > 0) cats.push('fees_revenue')
    if (sigFields.length > 0) cats.push('signatures')
    return cats
  }, [contractFields, feeFields, sigFields])

  const isDistributionUnlocked = verifiedCategories.size >= availableCategories.length

  const toggleCategory = (cat: VerificationCategory) => {
    setVerifiedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const markAllVerified = () => {
    setVerifiedCategories(new Set(availableCategories))
  }

  const handleActivate = (key: string) => {
    setActiveField(key)
    const pages = getPageRef(parsed_data, key)
    if (pages.length > 0) onScrollToPage(pages[0])
  }

  const handleDistributionAction = async (action: DistributionAction) => {
    if (action === ('copy' as unknown)) {
      const text = buildClipboardSummary(parsed_data, editedFields)
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
      onCopyFeedback('Summary copied to clipboard')
      return
    }
    setDistributionAction(action)
  }

  const fieldTableProps = {
    parsed_data, activeField,
    confidence: parsed_data.confidence || {},
    editingField, editValue, editedFields,
    onActivate: handleActivate,
    onScrollToPage,
    onStartEdit: (key: string, value: string) => { setEditingField(key); setEditValue(value || '') },
    onSaveEdit: (key: string) => { setEditedFields(prev => ({ ...prev, [key]: editValue })); setEditingField(null); setEditValue('') },
    onCancelEdit: () => { setEditingField(null); setEditValue('') },
    onEditChange: setEditValue,
  }

  return (
    <div className="space-y-4 p-5">
      <SummaryCard
        parsed_data={parsed_data}
        confidence={parsed_data.confidence}
        isUnlocked={isDistributionUnlocked}
        verifiedCount={verifiedCategories.size}
        totalCategories={availableCategories.length}
        activeAction={distributionAction}
        onAction={handleDistributionAction}
        editedFields={editedFields}
        extractedInfo={data.extracted_info}
        gmailAuth={gmailAuth}
        onGmailAuthClick={onGmailAuthClick}
        onSendEmail={onSendEmail}
      />

      <ContractTimeline parsed_data={parsed_data} />

      <VerificationProgress
        verified={verifiedCategories.size}
        total={availableCategories.length}
        onMarkAll={markAllVerified}
      />

      <ConfidenceHeatmap parsed_data={parsed_data} />

      {contractFields.length > 0 && (
        <ExpandableSection
          title="Contract Details"
          fieldCount={contractFields.length}
          isExpanded={expandedSections.has('contract_details')}
          onToggle={() => setExpandedSections(prev => { const next = new Set(prev); if (next.has('contract_details')) next.delete('contract_details'); else next.add('contract_details'); return next })}
          isVerified={verifiedCategories.has('contract_details')}
          onVerify={() => toggleCategory('contract_details')}
        >
          <ReviewFieldTable fields={contractFields} {...fieldTableProps} />
        </ExpandableSection>
      )}

      {feeFields.length > 0 && (
        <ExpandableSection
          title="Fees & Revenue"
          fieldCount={feeFields.length}
          isExpanded={expandedSections.has('fees_revenue')}
          onToggle={() => setExpandedSections(prev => { const next = new Set(prev); if (next.has('fees_revenue')) next.delete('fees_revenue'); else next.add('fees_revenue'); return next })}
          isVerified={verifiedCategories.has('fees_revenue')}
          onVerify={() => toggleCategory('fees_revenue')}
        >
          <ReviewFieldTable fields={feeFields} {...fieldTableProps} />
          {parsed_data.annual_fees && parsed_data.annual_fees.length > 0 && (
            <RevenueChart
              annualFees={parsed_data.annual_fees}
              onboardingFee={parsed_data.onboarding_fee}
              currency={parsed_data.currency}
            />
          )}
          <PaymentTimeline parsed_data={parsed_data} />
        </ExpandableSection>
      )}

      {sigFields.length > 0 && (
        <ExpandableSection
          title="Signatures & Terms"
          fieldCount={sigFields.length}
          isExpanded={expandedSections.has('signatures')}
          onToggle={() => setExpandedSections(prev => { const next = new Set(prev); if (next.has('signatures')) next.delete('signatures'); else next.add('signatures'); return next })}
          isVerified={verifiedCategories.has('signatures')}
          onVerify={() => toggleCategory('signatures')}
        >
          <ReviewFieldTable fields={sigFields} {...fieldTableProps} />
          <ClauseTags clauses={parsed_data.clauses} />
        </ExpandableSection>
      )}

      <ExpandableSection
        title="Full Extracted Text"
        isExpanded={expandedSections.has('raw_text')}
        onToggle={() => setExpandedSections(prev => { const next = new Set(prev); if (next.has('raw_text')) next.delete('raw_text'); else next.add('raw_text'); return next })}
      >
        <div className="space-y-2 p-2">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[13px] text-muted-foreground">Cleaned View</span>
            <button
              onClick={() => setShowSourceTags(!showSourceTags)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                !showSourceTags ? 'bg-foreground' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
                  !showSourceTags ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <ExtractedTextDisplay text={data.extracted_info} showTags={showSourceTags} />
        </div>
      </ExpandableSection>
    </div>
  )
}
