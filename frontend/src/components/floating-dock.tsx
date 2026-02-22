import { ArrowLeft, Check, X, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface FloatingDockProps {
  status: 'processing' | 'complete' | null
  onBack: () => void
  onStop: () => void
  onConfirmComplete: () => void
  onRejectComplete: () => void
}

export function FloatingDock({ status, onBack, onStop, onConfirmComplete, onRejectComplete }: FloatingDockProps) {
  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 shadow-float">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 gap-1.5 px-2 text-xs font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>

        <div className="h-4 w-px bg-border" />

        {status === 'processing' && (
          <>
            <Badge variant="warning" className="text-xs font-semibold">Processing</Badge>
            <Button variant="ghost" size="sm" onClick={onStop} className="h-7 gap-1.5 px-2 text-xs font-medium text-danger-text hover:text-danger-text">
              <Square className="h-3 w-3" />
              Stop
            </Button>
          </>
        )}

        {status === 'complete' && (
          <>
            <span className="text-xs text-muted-foreground">Processing Complete?</span>
            <Button variant="ghost" size="sm" onClick={onConfirmComplete} className="h-7 gap-1 px-2 text-xs font-medium text-success-text hover:text-success-text">
              <Check className="h-3.5 w-3.5" />
              Yes
            </Button>
            <Button variant="ghost" size="sm" onClick={onRejectComplete} className="h-7 gap-1 px-2 text-xs font-medium text-danger-text hover:text-danger-text">
              <X className="h-3.5 w-3.5" />
              No
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
