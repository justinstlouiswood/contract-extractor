import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ExtractedTextDisplay } from '@/components/extracted-text-display'

interface FullExtractedToggleProps {
  text: string
}

export function FullExtractedToggle({ text }: FullExtractedToggleProps) {
  const [open, setOpen] = useState(false)
  const [showTags, setShowTags] = useState(true)

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  return (
    <>
      <button
        type="button"
        className="extracted-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`section-chev${open ? '' : ' closed'}`}>
          <ChevronDown size={13} strokeWidth={1.5} />
        </span>
        <span>Full Extracted Text</span>
        <span className="ml-auto text-[11px] text-text-muted tabular-nums">
          {wordCount.toLocaleString()} words
        </span>
      </button>

      {open && (
        <div className="extracted-content">
          <div className="mb-3 flex items-center justify-end gap-2">
            <span className="text-[11px] text-text-muted">Cleaned View</span>
            <button
              type="button"
              onClick={() => setShowTags(!showTags)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                !showTags ? 'bg-accent' : 'bg-bg-active'
              }`}
              aria-label="Toggle source tags"
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-bg shadow-card transition-transform ${
                  !showTags ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <ExtractedTextDisplay text={text} showTags={showTags} />
        </div>
      )}
    </>
  )
}
