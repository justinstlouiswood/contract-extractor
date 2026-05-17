import { useState, useMemo } from 'react'
import { DocHero } from '@/components/doc-hero'
import { ConfidenceRow } from '@/components/confidence-row'
import { Section } from '@/components/section'
import { DistributionCard } from '@/components/distribution-card'
import { ReviewFieldTable } from '@/components/review-field-table'
import { RevenueChart } from '@/components/revenue-chart'
import { PaymentTimeline } from '@/components/payment-timeline'
import { ClauseTags } from '@/components/clause-tags'
import { FullExtractedToggle } from '@/components/full-extracted-toggle'
import { getVerifiableFields, getPageRef } from '@/lib/contract-utils'
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

export function ReviewView({
  data,
  gmailAuth,
  onGmailAuthClick,
  onSendEmail,
  onScrollToPage,
  onCopyFeedback,
}: ReviewViewProps) {
  const parsed_data = data.parsed_data

  const [verifiedCategories, setVerifiedCategories] = useState(new Set<VerificationCategory>())
  const [activeField, setActiveField] = useState<string | null>(null)
  const [distributionAction, setDistributionAction] = useState<DistributionAction>(null)

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editedFields, setEditedFields] = useState<Record<string, string>>({})

  const verifiableFields = useMemo(() => getVerifiableFields(parsed_data), [parsed_data])
  const contractFields = verifiableFields.filter((f) => f.section === 'contract_details')
  const feeFields = verifiableFields.filter((f) => f.section === 'fees_revenue')
  const sigFields = verifiableFields.filter((f) => f.section === 'signatures')

  const availableCategories = useMemo(() => {
    const cats: VerificationCategory[] = []
    if (contractFields.length > 0) cats.push('contract_details')
    if (feeFields.length > 0) cats.push('fees_revenue')
    if (sigFields.length > 0) cats.push('signatures')
    return cats
  }, [contractFields.length, feeFields.length, sigFields.length])

  const isDistributionUnlocked =
    availableCategories.length > 0 && verifiedCategories.size >= availableCategories.length

  const markAllVerified = () => {
    setVerifiedCategories(new Set(availableCategories))
  }

  const toggleCategory = (cat: VerificationCategory) => {
    setVerifiedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleActivate = (key: string) => {
    setActiveField(key)
    const pages = getPageRef(parsed_data, key)
    if (pages.length > 0) onScrollToPage(pages[0])
  }

  const fieldTableProps = {
    parsed_data,
    activeField,
    confidence: parsed_data.confidence || {},
    editingField,
    editValue,
    editedFields,
    onActivate: handleActivate,
    onScrollToPage,
    onStartEdit: (key: string, value: string) => {
      setEditingField(key)
      setEditValue(value || '')
    },
    onSaveEdit: (key: string) => {
      setEditedFields((prev) => ({ ...prev, [key]: editValue }))
      setEditingField(null)
      setEditValue('')
    },
    onCancelEdit: () => {
      setEditingField(null)
      setEditValue('')
    },
    onEditChange: setEditValue,
  }

  return (
    <>
      <DocHero
        parsed_data={parsed_data}
        verifiedCount={verifiedCategories.size}
        totalCategories={availableCategories.length}
        onMarkAllVerified={markAllVerified}
      />

      <ConfidenceRow confidence={parsed_data.confidence} />

      <div className="extract-scroll">
        <DistributionCard
          parsed_data={parsed_data}
          extractedInfo={data.extracted_info}
          editedFields={editedFields}
          isUnlocked={isDistributionUnlocked}
          verifiedCount={verifiedCategories.size}
          totalCategories={availableCategories.length}
          activeAction={distributionAction}
          onAction={setDistributionAction}
          onMarkAllVerified={markAllVerified}
          gmailAuth={gmailAuth}
          onGmailAuthClick={onGmailAuthClick}
          onSendEmail={onSendEmail}
          onCopyFeedback={onCopyFeedback}
        />

        {contractFields.length > 0 && (
          <Section
            title="Contract Details"
            count={contractFields.length}
            defaultOpen
            isVerified={verifiedCategories.has('contract_details')}
            onVerifyToggle={() => toggleCategory('contract_details')}
          >
            <ReviewFieldTable fields={contractFields} {...fieldTableProps} />
          </Section>
        )}

        {feeFields.length > 0 && (
          <Section
            title="Fees & Revenue"
            count={feeFields.length}
            defaultOpen
            isVerified={verifiedCategories.has('fees_revenue')}
            onVerifyToggle={() => toggleCategory('fees_revenue')}
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
          </Section>
        )}

        {sigFields.length > 0 && (
          <Section
            title="Signatures & Terms"
            count={sigFields.length}
            defaultOpen={false}
            isVerified={verifiedCategories.has('signatures')}
            onVerifyToggle={() => toggleCategory('signatures')}
          >
            <ReviewFieldTable fields={sigFields} {...fieldTableProps} />
            <ClauseTags
              clauses={parsed_data.clauses}
              pageRefs={parsed_data.page_refs}
              onScrollToPage={onScrollToPage}
              customerName={parsed_data.customer_name}
            />
          </Section>
        )}

        <FullExtractedToggle text={data.extracted_info} />
      </div>
    </>
  )
}
