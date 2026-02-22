import { ArrowLeft, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TopBarProps {
  showBack: boolean
  onBack: () => void
  status: 'processing' | 'complete' | null
  onStop: () => void
}

export function TopBar({ showBack, onBack, status, onStop }: TopBarProps) {
  return (
    <header className="flex h-13 items-center justify-between border-b border-border px-5">
      <div className="flex items-center gap-3">
        {showBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1.5 px-3 text-sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {status === 'processing' && (
          <>
            <Badge variant="warning" className="text-xs font-semibold">Processing</Badge>
            <Button variant="outline" size="sm" onClick={onStop} className="h-8 gap-1.5 px-3 text-sm">
              <Square className="h-3 w-3" />
              Stop
            </Button>
          </>
        )}
        {status === 'complete' && (
          <Badge variant="success" className="text-xs font-semibold">Complete</Badge>
        )}
      </div>
    </header>
  )
}
