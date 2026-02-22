import { useState } from 'react'
import { Download, Link, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { exportToExcel, exportToCSV, exportToJSON } from '@/lib/contract-utils'
import type { ParsedData, GmailAuth } from '@/types/contract'

const SHEETS_ID_KEY = 'contract_extractor_sheets_id'

interface SheetsPanelProps {
  parsed_data: ParsedData
  editedFields: Record<string, string>
  gmailAuth: GmailAuth
  onAuthClick: () => void
  onClose: () => void
}

export function SheetsPanel({ parsed_data, editedFields, gmailAuth, onAuthClick, onClose }: SheetsPanelProps) {
  const [sheetsId, setSheetsId] = useState(() => localStorage.getItem(SHEETS_ID_KEY) || '')
  const [pushing, setPushing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handlePush = async () => {
    if (!sheetsId.trim()) { setFeedback({ type: 'error', message: 'Enter a Google Sheet ID' }); return }
    localStorage.setItem(SHEETS_ID_KEY, sheetsId)
    setPushing(true)
    try {
      const resp = await fetch('/push-to-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheet_id: sheetsId, parsed_data }),
      })
      const result = await resp.json()
      if (result.success) {
        setFeedback({ type: 'success', message: 'Added to sheet' })
      } else {
        setFeedback({ type: 'error', message: result.error || 'Failed' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message })
    } finally {
      setPushing(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="space-y-2 rounded-sm border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Push to Sheets / Download</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportToExcel(parsed_data, editedFields)}>
          <Download className="h-3 w-3" /> Excel
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportToCSV(parsed_data, editedFields)}>
          <Download className="h-3 w-3" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportToJSON(parsed_data, editedFields)}>
          <Download className="h-3 w-3" /> JSON
        </Button>
      </div>

      <Separator />

      <p className="text-[11px] text-muted-foreground">or push to Google Sheets</p>

      {!gmailAuth.authenticated ? (
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onAuthClick}>
          <Link className="h-3 w-3" /> Connect Google
        </Button>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Spreadsheet ID</label>
            <Input className="h-7 font-mono text-xs" placeholder="Sheet ID from URL" value={sheetsId} onChange={e => setSheetsId(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePush} disabled={pushing}>
            {pushing ? 'Pushing...' : 'Push Row'}
          </Button>
        </>
      )}
      {feedback && (
        <p className={`text-xs ${feedback.type === 'error' ? 'text-danger-text' : 'text-success-text'}`}>
          {feedback.message}
        </p>
      )}
    </div>
  )
}
