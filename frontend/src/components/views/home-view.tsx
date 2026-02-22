import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { Dropzone } from '@/components/dropzone'
import { HomeContractTable } from '@/components/home-contract-table'
import { formatCurrency } from '@/lib/contract-utils'
import type { ContractRecord } from '@/types/contract'

interface HomeViewProps {
  recentContracts: ContractRecord[]
  onFileSelect: (file: File) => void
  onSelectContract: (contract: ContractRecord) => void
  onClearRecents: () => void
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-card p-6">
      <span className="text-xs font-normal text-muted-foreground">{label}</span>
      <span className="text-[28px] font-semibold leading-tight tracking-tight">{value}</span>
    </div>
  )
}

export function HomeView({ recentContracts, onFileSelect, onSelectContract, onClearRecents }: HomeViewProps) {
  const stats = useMemo(() => {
    const count = recentContracts.length
    const totalValue = recentContracts.reduce((sum, c) => sum + (c.total_value || 0), 0)
    const lastDate = recentContracts.length > 0
      ? new Date(recentContracts[0].date_processed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '\u2014'
    return { count, totalValue, lastDate }
  }, [recentContracts])

  const hasContracts = recentContracts.length > 0

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background">
      <div className="mx-auto w-full max-w-[1100px] space-y-5 px-6 py-8">
        {/* Page header */}
        <h1 className="flex items-center justify-center gap-2.5 text-[22px] font-semibold tracking-tight">
          <FileText className="h-5.5 w-5.5 text-muted-foreground" strokeWidth={1.5} />
          MSA Extraction Machine
        </h1>

        {/* Zone 1 — Summary Strip */}
        <div className="flex gap-3">
          <StatCard label="Total Contracts" value={String(stats.count)} />
          <StatCard
            label="Total Contract Value"
            value={stats.totalValue > 0 ? `${formatCurrency(stats.totalValue)} USD` : '\u2014'}
          />
          <StatCard label="Last Extracted" value={stats.lastDate} />
        </div>

        {/* Zone 2 — Split Layout */}
        <div className="flex gap-4">
          {/* Left column — Recent Extractions Table (60%) */}
          <div className="min-w-0 flex-[3]">
            {hasContracts ? (
              <HomeContractTable contracts={recentContracts} onSelect={onSelectContract} onClear={onClearRecents} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card p-12">
                <p className="text-sm italic text-[#9494A8]">
                  No extractions yet. Upload your first MSA to get started.
                </p>
              </div>
            )}
          </div>

          {/* Right column — Upload Drop Zone (40%) */}
          <div className="flex-[2]">
            <Dropzone onFileSelect={onFileSelect} fill />
          </div>
        </div>
      </div>
    </div>
  )
}
