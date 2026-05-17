import { parseExtractedText, stripSourceTags, getTagColor } from '@/lib/contract-utils'

interface ExtractedTextDisplayProps {
  text: string
  showTags: boolean
}

export function ExtractedTextDisplay({ text, showTags }: ExtractedTextDisplayProps) {
  if (!showTags) {
    return (
      <pre className="whitespace-pre-wrap text-[12px] leading-[1.65] text-text-default">
        {stripSourceTags(text)}
      </pre>
    )
  }

  const segments = parseExtractedText(text)
  return (
    <pre className="whitespace-pre-wrap text-[12px] leading-[1.65] text-text-default">
      {segments.map((segment, idx) => {
        if (segment.type === 'tag') {
          return (
            <span
              key={idx}
              className={`inline-block rounded-[4px] px-1 py-0.5 text-[10px] font-semibold ${getTagColor(segment.signal || '')}`}
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
