import { useState, useEffect } from 'react'
import { Send, Link, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ParsedData, GmailAuth } from '@/types/contract'

interface EmailSectionProps {
  contractData: ParsedData
  extractedInfo: string
  gmailAuth: GmailAuth
  onAuthClick: () => void
  onSendEmail?: (result: { success: boolean }) => void
  onClose?: () => void
}

export function EmailSection({ contractData, extractedInfo, gmailAuth, onAuthClick, onSendEmail, onClose }: EmailSectionProps) {
  const [toEmail, setToEmail] = useState('')
  const [ccEmail, setCcEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [feedback, setFeedback] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  useEffect(() => {
    if (contractData) {
      const customerName = contractData.customer_name || 'Contract'
      const signingDate = contractData.signatures?.customer?.date || contractData.subscription_start || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      setSubject(`${customerName} MSA - ${signingDate}`)
      setBody(extractedInfo || '')
      if (contractData.point_of_contact?.email) setToEmail(contractData.point_of_contact.email)
    }
  }, [contractData, extractedInfo])

  const handleSend = async () => {
    if (!toEmail.trim()) {
      setFeedback({ show: true, message: 'Enter a recipient email', type: 'error' })
      setTimeout(() => setFeedback(f => ({ ...f, show: false })), 3000)
      return
    }
    setSending(true)
    try {
      const response = await fetch('/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toEmail, cc: ccEmail || undefined, subject, body }),
      })
      const result = await response.json()
      if (result.success) {
        setFeedback({ show: true, message: 'Email sent!', type: 'success' })
        onSendEmail?.(result)
      } else {
        setFeedback({ show: true, message: result.error || 'Failed to send', type: 'error' })
      }
    } catch (err) {
      setFeedback({ show: true, message: 'Failed: ' + (err as Error).message, type: 'error' })
    } finally {
      setSending(false)
      setTimeout(() => setFeedback(f => ({ ...f, show: false })), 4000)
    }
  }

  if (!gmailAuth.authenticated) {
    return (
      <div className="space-y-2 rounded-sm border border-border p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Connect Gmail to send</span>
          {onClose && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3 w-3" /></Button>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onAuthClick}>
          <Link className="h-3 w-3" /> Connect Gmail
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-sm border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Send via Gmail</span>
          {gmailAuth.email && <span className="font-mono text-[11px] text-muted-foreground">as {gmailAuth.email}</span>}
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3 w-3" /></Button>
        )}
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">To</label>
          <div className="flex items-center gap-1">
            <Input className="h-7 text-xs" placeholder="recipient@example.com" value={toEmail} onChange={e => setToEmail(e.target.value)} />
            {!showCc && (
              <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground" onClick={() => setShowCc(true)}>+ CC</Button>
            )}
          </div>
        </div>
        {showCc && (
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">CC</label>
            <Input className="h-7 text-xs" placeholder="cc@example.com" value={ccEmail} onChange={e => setCcEmail(e.target.value)} />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Subject</label>
          <Input className="h-7 text-xs" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Body</label>
          <Textarea className="text-xs" value={body} onChange={e => setBody(e.target.value)} rows={6} />
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : <><Send className="h-3 w-3" /> Send</>}
        </Button>
        {feedback.show && (
          <p className={`text-xs ${feedback.type === 'error' ? 'text-danger-text' : 'text-success-text'}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  )
}
