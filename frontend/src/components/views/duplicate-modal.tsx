import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/contract-utils'
import type { ContractRecord } from '@/types/contract'

interface DuplicateModalProps {
  contract: ContractRecord
  onViewExisting: () => void
  onProcessAnyway: () => void
  onClose: () => void
}

export function DuplicateModal({ contract, onViewExisting, onProcessAnyway, onClose }: DuplicateModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-text">Contract Already Processed</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-text-muted">
          A contract for{' '}
          <span className="font-medium text-text">{contract.customer_name}</span> with value{' '}
          <span className="font-medium text-text tabular-nums">
            {formatCurrency(contract.total_value)} {contract.currency}
          </span>{' '}
          was already processed.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewExisting}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-btn-border bg-accent px-3 text-[12px] font-medium text-accent-fg shadow-btn hover:shadow-btn-hover"
          >
            View Existing
          </button>
          <button
            type="button"
            onClick={onProcessAnyway}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-btn-border bg-bg px-3 text-[12px] font-medium text-text-default shadow-btn hover:shadow-btn-hover"
          >
            Process Anyway
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
