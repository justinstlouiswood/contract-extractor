import type { ParsedData, VerifiableField } from '@/types/contract'
import * as XLSX from 'xlsx'

export function formatCurrency(amount: number): string {
  return '$' + new Intl.NumberFormat('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function sanitizeFilename(name: string): string {
  if (!name) return 'contract'
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high'
  if (score >= 60) return 'medium'
  return 'low'
}

export function getConfidenceLabel(score: number): string {
  if (score >= 85) return 'High'
  if (score >= 60) return 'Medium'
  return 'Low'
}

export function getVerifiableFields(parsed_data: ParsedData): VerifiableField[] {
  if (!parsed_data) return []
  const fields: VerifiableField[] = []
  const currency = parsed_data.currency || 'CAD'

  if (parsed_data.customer_name) fields.push({ key: 'customer_name', label: 'Customer', value: parsed_data.customer_name, section: 'contract_details' })
  if (parsed_data.duration) fields.push({ key: 'duration', label: 'Duration', value: parsed_data.duration, section: 'contract_details' })
  if (parsed_data.subscription_start) fields.push({ key: 'subscription_start', label: 'Start Date', value: parsed_data.subscription_start, section: 'contract_details' })
  if (parsed_data.subscription_end) fields.push({ key: 'subscription_end', label: 'End Date', value: parsed_data.subscription_end, section: 'contract_details' })
  if (parsed_data.point_of_contact?.name) fields.push({ key: 'point_of_contact_name', label: 'Contact', value: parsed_data.point_of_contact.name, section: 'contract_details' })
  if (parsed_data.point_of_contact?.email) fields.push({ key: 'point_of_contact_email', label: 'Email', value: parsed_data.point_of_contact.email, section: 'contract_details', isLink: true })
  if (parsed_data.billing_contact?.name) fields.push({ key: 'billing_contact_name', label: 'Billing Contact', value: parsed_data.billing_contact.name, section: 'contract_details' })
  if (parsed_data.billing_contact?.email) fields.push({ key: 'billing_contact_email', label: 'Billing Email', value: parsed_data.billing_contact.email, section: 'contract_details', isLink: true })

  if (parsed_data.onboarding_fee && parsed_data.onboarding_fee > 0) fields.push({ key: 'onboarding_fee', label: 'Onboarding Fee', value: formatCurrency(parsed_data.onboarding_fee) + ' ' + currency, section: 'fees_revenue' })
  if (parsed_data.payment_terms) fields.push({ key: 'payment_terms', label: 'Payment Terms', value: parsed_data.payment_terms, section: 'fees_revenue' })
  if (parsed_data.annual_fees) {
    parsed_data.annual_fees.forEach(fee => {
      fields.push({ key: `annual_fee_year_${fee.year}`, label: `Year ${fee.year} Fee`, value: formatCurrency(fee.amount) + ' ' + currency, section: 'fees_revenue' })
    })
  }

  if (parsed_data.signatures?.customer?.name) {
    const sig = parsed_data.signatures.customer
    fields.push({ key: 'signature_customer', label: 'Customer Signature', value: `${sig.name}${sig.date ? ` (${sig.date})` : ''}`, section: 'signatures' })
  }
  if (parsed_data.signatures?.vendor?.name) {
    const sig = parsed_data.signatures.vendor
    fields.push({ key: 'signature_vendor', label: 'Vendor Signature', value: `${sig.name}${sig.date ? ` (${sig.date})` : ''}`, section: 'signatures' })
  }
  if (parsed_data.notes) fields.push({ key: 'notes', label: 'Notes', value: parsed_data.notes, section: 'signatures' })
  if (parsed_data.additional_terms) fields.push({ key: 'additional_terms', label: 'Additional Terms', value: parsed_data.additional_terms, section: 'signatures' })

  return fields
}

export function getPageRef(parsed_data: ParsedData, fieldKey: string): number[] {
  if (!parsed_data?.page_refs) return []
  if (parsed_data.page_refs[fieldKey]) return parsed_data.page_refs[fieldKey]
  const mapping: Record<string, string> = {
    'point_of_contact_name': 'point_of_contact',
    'point_of_contact_email': 'point_of_contact',
    'billing_contact_name': 'billing_contact',
    'billing_contact_email': 'billing_contact',
  }
  if (mapping[fieldKey] && parsed_data.page_refs[mapping[fieldKey]]) {
    return parsed_data.page_refs[mapping[fieldKey]]
  }
  return []
}

export function buildClipboardSummary(parsed_data: ParsedData, editedFields: Record<string, string> = {}): string {
  const get = (key: string, original?: string) => key in editedFields ? editedFields[key] : original
  const currency = parsed_data.currency || 'CAD'
  const lines: string[] = []

  lines.push(`Contract Summary: ${get('customer_name', parsed_data.customer_name) || 'Unknown'}`)
  lines.push('')
  if (parsed_data.total_contract_value && parsed_data.total_contract_value > 0) {
    lines.push(`Total Contract Value: ${formatCurrency(parsed_data.total_contract_value)} ${currency}`)
  }
  if (parsed_data.duration) lines.push(`Duration: ${get('duration', parsed_data.duration)}`)
  if (parsed_data.subscription_start) lines.push(`Start: ${get('subscription_start', parsed_data.subscription_start)}`)
  if (parsed_data.subscription_end) lines.push(`End: ${get('subscription_end', parsed_data.subscription_end)}`)
  if (parsed_data.point_of_contact?.name) {
    const name = get('point_of_contact_name', parsed_data.point_of_contact.name)
    const email = get('point_of_contact_email', parsed_data.point_of_contact.email)
    lines.push(`Contact: ${name}${email ? ` (${email})` : ''}`)
  }
  lines.push('')
  if (parsed_data.annual_fees?.length) {
    parsed_data.annual_fees.forEach(fee => {
      lines.push(`Year ${fee.year}: ${formatCurrency(fee.amount)} ${currency}`)
    })
  }
  if (parsed_data.onboarding_fee && parsed_data.onboarding_fee > 0) {
    lines.push(`Onboarding: ${formatCurrency(parsed_data.onboarding_fee)} ${currency}`)
  }

  return lines.join('\n')
}

// Source tag parsing
interface TextSegment {
  type: 'text' | 'tag'
  content?: string
  signal?: string
}

export function parseExtractedText(text: string): TextSegment[] {
  const tagRegex = /\[(EXPLICIT|INFERRED|PARTIAL|MULTIPLE|NOT_FOUND)(?::\d+(?:,\d+)*)?\]/g
  const segments: TextSegment[] = []
  let lastIndex = 0
  let match

  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'tag', signal: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return segments
}

export function stripSourceTags(text: string): string {
  return text.replace(/\[(?:EXPLICIT|INFERRED|PARTIAL|MULTIPLE|NOT_FOUND)(?::\d+(?:,\d+)*)?\]\s*/g, '')
}

export function getTagColor(signal: string): string {
  const colors: Record<string, string> = {
    'EXPLICIT': 'bg-tag-explicit-bg text-tag-explicit-text',
    'INFERRED': 'bg-tag-inferred-bg text-tag-inferred-text',
    'PARTIAL': 'bg-tag-inferred-bg text-tag-inferred-text',
    'MULTIPLE': 'bg-tag-notfound-bg text-tag-notfound-text',
    'NOT_FOUND': 'bg-tag-notfound-bg text-tag-notfound-text',
  }
  return colors[signal] || 'bg-muted text-muted-foreground/70'
}

// Export helpers
function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildExportData(parsed_data: ParsedData, editedFields: Record<string, string> = {}) {
  const currency = parsed_data.currency || 'CAD'
  const formatFee = (amount?: number) => amount ? formatCurrency(amount) + ' ' + currency : 'Not specified'
  const get = (key: string, original?: string) => key in editedFields ? editedFields[key] : original

  return {
    contractDetails: {
      customer: get('customer_name', parsed_data.customer_name) || 'Not specified',
      duration: get('duration', parsed_data.duration) || 'Not specified',
      startDate: get('subscription_start', parsed_data.subscription_start) || 'Not specified',
      endDate: get('subscription_end', parsed_data.subscription_end) || 'Not specified',
      contact: get('point_of_contact_name', parsed_data.point_of_contact?.name) || 'Not specified',
      email: get('point_of_contact_email', parsed_data.point_of_contact?.email) || 'Not specified',
    },
    termsAndFees: {
      onboardingFee: get('onboarding_fee', formatFee(parsed_data.onboarding_fee)),
      ...(parsed_data.annual_fees || []).reduce((acc: Record<string, string | undefined>, fee) => {
        const feeKey = `annual_fee_${fee.year}`
        acc[`year${fee.year}Fee`] = get(feeKey, formatFee(fee.amount))
        return acc
      }, {}),
      customerSignature: get('signature_customer', parsed_data.signatures?.customer?.name
        ? `${parsed_data.signatures.customer.name}${parsed_data.signatures.customer.date ? ` (${parsed_data.signatures.customer.date})` : ''}`
        : 'Not specified'),
      vendorSignature: get('signature_vendor', parsed_data.signatures?.vendor?.name
        ? `${parsed_data.signatures.vendor.name}${parsed_data.signatures.vendor.date ? ` (${parsed_data.signatures.vendor.date})` : ''}`
        : 'Not specified'),
    },
  }
}

export function exportToCSV(parsed_data: ParsedData, editedFields: Record<string, string> = {}) {
  const data = buildExportData(parsed_data, editedFields)
  const rows: string[][] = [['Category', 'Field', 'Value']]
  rows.push(['Contract Details', 'Customer', data.contractDetails.customer || ''])
  rows.push(['Contract Details', 'Duration', data.contractDetails.duration || ''])
  rows.push(['Contract Details', 'Start Date', data.contractDetails.startDate || ''])
  rows.push(['Contract Details', 'End Date', data.contractDetails.endDate || ''])
  rows.push(['Contract Details', 'Contact', data.contractDetails.contact || ''])
  rows.push(['Contract Details', 'Email', data.contractDetails.email || ''])
  rows.push(['Terms & Fees', 'Onboarding Fee', data.termsAndFees.onboardingFee || ''])
  Object.keys(data.termsAndFees).forEach(key => {
    if (key.startsWith('year')) {
      const yearNum = key.match(/year(\d+)/)?.[1]
      rows.push(['Terms & Fees', `Year ${yearNum} Fee`, (data.termsAndFees as Record<string, string>)[key] || ''])
    }
  })
  rows.push(['Terms & Fees', 'Customer Signature', data.termsAndFees.customerSignature || ''])
  rows.push(['Terms & Fees', 'Vendor Signature', data.termsAndFees.vendorSignature || ''])

  const csvContent = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const customerName = 'customer_name' in editedFields ? editedFields.customer_name : parsed_data.customer_name
  downloadFile(csvContent, sanitizeFilename(customerName || '') + '_extraction.csv', 'text/csv;charset=utf-8;')
}

export function exportToJSON(parsed_data: ParsedData, editedFields: Record<string, string> = {}) {
  const data = buildExportData(parsed_data, editedFields)
  const jsonContent = JSON.stringify({ exportDate: new Date().toISOString(), ...data }, null, 2)
  const customerName = 'customer_name' in editedFields ? editedFields.customer_name : parsed_data.customer_name
  downloadFile(jsonContent, sanitizeFilename(customerName || '') + '_extraction.json', 'application/json')
}

// ============================================
// DATE PARSING
// ============================================

export function parseContractDate(str: string | undefined | null): Date | null {
  if (!str || str === 'Not specified') return null

  // Try "January 3, 2025" format
  const longMatch = str.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (longMatch) {
    const d = new Date(`${longMatch[1]} ${longMatch[2]}, ${longMatch[3]}`)
    return isNaN(d.getTime()) ? null : d
  }

  // Try "1/3/2025" or "01/03/2025" format
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const d = new Date(+slashMatch[3], +slashMatch[1] - 1, +slashMatch[2])
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback: let Date.parse try
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============================================
// CONFIDENCE HEATMAP
// ============================================

export function getHeatmapColor(score: number): string {
  if (score >= 85) return 'var(--success-bg)'
  return 'var(--danger-bg)'
}

export function getConfidenceFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    customer_name: 'Customer',
    subscription_start: 'Start Date',
    subscription_end: 'End Date',
    duration: 'Duration',
    onboarding_fee: 'Onboarding Fee',
    payment_terms: 'Payment Terms',
    point_of_contact: 'Contact',
    billing_contact: 'Billing Contact',
    annual_fees: 'Annual Fees',
    total_contract_value: 'Total Value',
    signature_customer: 'Customer Signature',
    signature_vendor: 'Vendor Signature',
  }
  return labels[key] || key
}

// ============================================
// CLAUSE LABELS
// ============================================

export const CLAUSE_LABELS: Record<string, string> = {
  auto_renewal: 'Auto-Renewal',
  termination_convenience: 'Termination',
  sla_guarantee: 'SLA',
  liability_cap: 'Liability Cap',
  data_processing: 'DPA',
  price_escalation: 'Escalation',
  exclusivity: 'Exclusivity',
  indemnification: 'Indemnification',
}

export function exportToExcel(parsed_data: ParsedData, editedFields: Record<string, string> = {}) {
  const data = buildExportData(parsed_data, editedFields)
  const rows = [
    ['Category', 'Field', 'Value'],
    ['Contract Details', 'Customer', data.contractDetails.customer],
    ['Contract Details', 'Duration', data.contractDetails.duration],
    ['Contract Details', 'Start Date', data.contractDetails.startDate],
    ['Contract Details', 'End Date', data.contractDetails.endDate],
    ['Contract Details', 'Contact', data.contractDetails.contact],
    ['Contract Details', 'Email', data.contractDetails.email],
    ['Terms & Fees', 'Onboarding Fee', data.termsAndFees.onboardingFee],
  ]
  Object.keys(data.termsAndFees).forEach(key => {
    if (key.startsWith('year')) {
      const yearNum = key.match(/year(\d+)/)?.[1]
      rows.push(['Terms & Fees', `Year ${yearNum} Fee`, (data.termsAndFees as Record<string, string | undefined>)[key] || ''])
    }
  })
  rows.push(['Terms & Fees', 'Customer Signature', data.termsAndFees.customerSignature])
  rows.push(['Terms & Fees', 'Vendor Signature', data.termsAndFees.vendorSignature])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contract')
  const customerName = 'customer_name' in editedFields ? editedFields.customer_name : parsed_data.customer_name
  XLSX.writeFile(wb, sanitizeFilename(customerName || '') + '_extraction.xlsx')
}
