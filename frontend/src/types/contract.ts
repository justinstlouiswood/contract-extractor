export interface Contact {
  name?: string
  email?: string
  title?: string
}

export interface Signature {
  name?: string
  date?: string
  title?: string
}

export interface AnnualFee {
  year: number
  amount: number
}

export interface ClauseInfo {
  present: boolean
  description?: string | null
}

export interface ParsedData {
  customer_name?: string
  duration?: string
  subscription_start?: string
  subscription_end?: string
  total_contract_value?: number
  currency?: string
  onboarding_fee?: number
  payment_terms?: string
  annual_fees?: AnnualFee[]
  point_of_contact?: Contact
  billing_contact?: Contact
  signatures?: {
    customer?: Signature
    vendor?: Signature
  }
  notes?: string
  additional_terms?: string
  clauses?: Record<string, ClauseInfo>
  confidence?: Record<string, number>
  page_refs?: Record<string, number[]>
}

export interface ContractResult {
  parsed_data: ParsedData
  extracted_info: string
  summary?: string
  pdf_id: string | null
}

export interface ContractRecord {
  id: string
  customer_name: string
  total_value: number
  currency: string
  date_processed: string
  parsed_data: ParsedData
  extracted_info: string
  summary?: string
  pdf_id: string | null
}

export interface VerifiableField {
  key: string
  label: string
  value: string
  section: 'contract_details' | 'fees_revenue' | 'signatures'
  isLink?: boolean
}

export interface GmailAuth {
  authenticated: boolean
  email: string | null
}

export interface ProcessingStep {
  label: string
  status: 'pending' | 'in_progress' | 'complete'
  message: string
}

export type AppView = 'empty' | 'processing' | 'detail'

export type DistributionAction = 'email' | 'slack' | 'sheets' | null

export type VerificationCategory = 'contract_details' | 'fees_revenue' | 'signatures'
