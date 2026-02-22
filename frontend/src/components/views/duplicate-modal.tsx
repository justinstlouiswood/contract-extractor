import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
      <DialogContent className="max-w-sm rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">Contract Already Processed</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          A contract for <span className="font-medium text-foreground">{contract.customer_name}</span> with value{' '}
          <span className="font-medium text-foreground">{formatCurrency(contract.total_value)} {contract.currency}</span>{' '}
          was already processed.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={onViewExisting}>View Existing</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onProcessAnyway}>Process Anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
