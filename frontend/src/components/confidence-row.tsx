import { Info } from 'lucide-react'

interface ConfidenceRowProps {
  confidence?: Record<string, number>
}

export function ConfidenceRow({ confidence }: ConfidenceRowProps) {
  if (!confidence) return null
  const scores = Object.values(confidence)
  if (scores.length === 0) return null

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const tier = avg >= 85 ? 'high' : 'low'

  return (
    <div className="confidence-row">
      <Info size={12} strokeWidth={1.5} className="text-text-muted" />
      <span className="confidence-label">Extraction Confidence</span>
      <span className={`confidence-pct ${tier}`}>{avg}%</span>
      <span className="confidence-method">
        Signal strength (50%) · Format validation (25%) · Cross-field consistency (25%)
      </span>
    </div>
  )
}
