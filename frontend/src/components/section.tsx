import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface SectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  isVerified?: boolean
  onVerifyToggle?: () => void
  children: ReactNode
}

export function Section({
  title,
  count,
  defaultOpen = true,
  isVerified,
  onVerifyToggle,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="section">
      <div className="section-header-wrap">
        <button
          type="button"
          className="section-header"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="section-header-left">
            <span className={`section-chev${open ? '' : ' closed'}`}>
              <ChevronDown size={13} strokeWidth={1.5} />
            </span>
            <span className="section-title">{title}</span>
            {typeof count === 'number' && (
              <span className="section-count tabular-nums">{count}</span>
            )}
          </span>
        </button>

        {onVerifyToggle && (
          <label
            className={`section-verify${isVerified ? ' verified' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={!!isVerified}
              onCheckedChange={() => onVerifyToggle()}
              className="size-3.5"
              aria-label={`Mark ${title} verified`}
            />
            <span>{isVerified ? 'Verified' : 'Verify'}</span>
          </label>
        )}
      </div>
      {open && children}
    </div>
  )
}
