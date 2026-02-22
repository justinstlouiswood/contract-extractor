import { useState, useCallback } from 'react'
import type { ContractRecord, ContractResult } from '@/types/contract'

const STORAGE_KEY = 'contract_extractor_history'
const MAX_HISTORY = 20

function readContracts(): ContractRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function generateId(data: ContractResult): string {
  const name = data.parsed_data?.customer_name || ''
  const value = data.parsed_data?.total_contract_value || 0
  return `${name.toLowerCase().replace(/\s+/g, '_')}_${value}`
}

export function useRecentContracts() {
  const [contracts, setContracts] = useState<ContractRecord[]>(readContracts)

  const save = useCallback((data: ContractResult): ContractRecord => {
    const history = readContracts()
    const newId = generateId(data)

    const existingIndex = history.findIndex(c => c.id === newId)
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1)
    }

    const record: ContractRecord = {
      id: newId,
      customer_name: data.parsed_data?.customer_name || 'Unknown',
      total_value: data.parsed_data?.total_contract_value || 0,
      currency: data.parsed_data?.currency || 'CAD',
      date_processed: new Date().toISOString(),
      parsed_data: data.parsed_data!,
      extracted_info: data.extracted_info,
      summary: data.summary,
      pdf_id: data.pdf_id || null,
    }

    history.unshift(record)
    while (history.length > MAX_HISTORY) history.pop()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    setContracts([...history])
    return record
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setContracts([])
  }, [])

  return { contracts, save, clear }
}
