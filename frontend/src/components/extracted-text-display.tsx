import { parseExtractedText, stripSourceTags, getTagColor } from '@/lib/contract-utils'

interface ExtractedTextDisplayProps {
  text: string
  showTags: boolean
}

export function ExtractedTextDisplay({ text, showTags }: ExtractedTextDisplayProps) {
  if (!showTags) {
    return <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">{stripSourceTags(text)}</pre>
  }

  const segments = parseExtractedText(text)
  return (
    <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
      {segments.map((segment, idx) => {
        if (segment.type === 'tag') {
          return (
            <span
              key={idx}
              className={`inline-block rounded-md px-1 py-0.5 text-[13px] font-medium ${getTagColor(segment.signal || '')}`}
            >
              {segment.signal}
            </span>
          )
        }
        return <span key={idx}>{segment.content}</span>
      })}
    </pre>
  )
}
