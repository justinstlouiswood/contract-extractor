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
      <div className={`flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 shadow-card${onVerify !== undefined && !isVerified ? ' opacity-80' : ''}`}>
        {onVerify !== undefined && (
          <Checkbox
            checked={isVerified}
            onCheckedChange={() => onVerify()}
          />
        )}
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-xs font-semibold hover:text-foreground/80">
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          <span className="flex-1">{title}</span>
          {fieldCount !== undefined && (
            <Badge variant="secondary" className="text-xs">{fieldCount}</Badge>
          )}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="rounded-b-sm border-x border-b border-border bg-surface-tint px-1.5 pb-1.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
