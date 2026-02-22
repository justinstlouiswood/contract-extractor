import { type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

interface ExpandableSectionProps {
  title: string
  fieldCount?: number
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
  isVerified?: boolean
  onVerify?: () => void
}

export function ExpandableSection({ title, fieldCount, isExpanded, onToggle, children, isVerified, onVerify }: ExpandableSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-3">
        {onVerify !== undefined && (
          <Checkbox
            checked={isVerified}
            onCheckedChange={() => onVerify()}
          />
        )}
        <CollapsibleTrigger className="flex flex-1 items-center gap-2.5 text-left text-sm font-semibold hover:text-foreground/80">
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          <span className="flex-1">{title}</span>
          {fieldCount !== undefined && (
            <Badge variant="secondary" className="text-xs">{fieldCount}</Badge>
          )}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="rounded-b-lg border-x border-b border-border px-2 pb-2">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
