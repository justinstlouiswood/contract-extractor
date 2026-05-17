import { useState } from 'react'
import { Hash, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ParsedData } from '@/types/contract'

const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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'

interface SlackPanelProps {
  parsed_data: ParsedData
  onClose: () => void
}

export function SlackPanel({ parsed_data, onClose }: SlackPanelProps) {
  const [posting, setPosting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handlePost = async () => {
    setPosting(true)
    try {
      const resp = await fetch('/send-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: SLACK_WEBHOOK_URL, parsed_data }),
      })
      const result = await resp.json()
      if (result.success) {
        setFeedback({ type: 'success', message: 'Posted to #revenue_operations' })
      } else {
        setFeedback({ type: 'error', message: result.error || 'Failed' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message })
    } finally {
      setPosting(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="space-y-2.5 rounded-sm border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Post to Slack</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-2">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Shares to <span className="font-medium text-foreground">revenue_operations</span> channel</span>
      </div>
      <Button variant="outline" size="sm" className="h-8 text-sm" onClick={handlePost} disabled={posting}>
        {posting ? 'Posting...' : 'Post Summary'}
      </Button>
      {feedback && (
        <p className={`text-sm ${feedback.type === 'error' ? 'text-danger-text' : 'text-success-text'}`}>
          {feedback.message}
        </p>
      )}
    </div>
  )
}
