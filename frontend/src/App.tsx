import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AppSidebar } from '@/components/app-sidebar'
import { UploadDialog } from '@/components/upload-dialog'
import { EmptyState } from '@/components/empty-state'
import { CopyFeedback } from '@/components/copy-feedback'
import { ProcessingView } from '@/components/views/processing-view'
import { ReviewView } from '@/components/views/review-view'
import { PDFViewerPanel } from '@/components/views/pdf-viewer-panel'
import { DuplicateModal } from '@/components/views/duplicate-modal'
import { useTheme } from '@/hooks/use-theme'
import { useRecentContracts } from '@/hooks/use-recent-contracts'
import type { AppView, ContractResult, ContractRecord, GmailAuth, ProcessingStep } from '@/types/contract'

export default function App() {
  useTheme()
  const { contracts: recentContracts, save: saveContract, remove: removeContract } = useRecentContracts()

  const [view, setView] = useState<AppView>('empty')
  const [currentContract, setCurrentContract] = useState<ContractResult | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState({ show: false, message: '' })
  const [duplicateContract, setDuplicateContract] = useState<ContractRecord | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Validating file', status: 'pending', message: '' },
    { label: 'Extracting text from PDF', status: 'pending', message: '' },
    { label: 'Analyzing contract with AI', status: 'pending', message: '' },
    { label: 'Generating summary', status: 'pending', message: '' },
  ])
  const [gmailAuth, setGmailAuth] = useState<GmailAuth>({ authenticated: false, email: null })
  const [pdfId, setPdfId] = useState<string | null>(null)
  const [pdfExpired, setPdfExpired] = useState(false)
  const [scrollToPage, setScrollToPage] = useState<number | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    checkGmailAuthStatus()
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'gmail_auth_success') checkGmailAuthStatus()
      else if (event.data?.type === 'gmail_auth_error') setError('Gmail authorization failed: ' + event.data.error)
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const checkGmailAuthStatus = async () => {
    try {
      const response = await fetch('/auth/status')
      const data = await response.json()
      setGmailAuth({ authenticated: data.authenticated, email: data.email })
    } catch (err) {
      console.error('Failed to check Gmail auth status:', err)
    }
  }

  const handleGmailAuthClick = async () => {
    try {
      const response = await fetch('/auth/gmail')
      const data = await response.json()
      if (data.success && data.authorization_url) {
        const width = 600, height = 700
        const left = (window.innerWidth - width) / 2
        const top = (window.innerHeight - height) / 2
        window.open(data.authorization_url, 'Gmail Authorization', `width=${width},height=${height},left=${left},top=${top}`)
      } else {
        setError(data.error || 'Failed to start authorization')
      }
    } catch (err) {
      setError('Failed to connect: ' + (err as Error).message)
    }
  }

  const handleSendEmail = () => {
    setCopyFeedback({ show: true, message: 'Email sent!' })
    setTimeout(() => setCopyFeedback({ show: false, message: '' }), 3000)
  }

  const handleCopyFeedback = (message: string) => {
    setCopyFeedback({ show: true, message })
    setTimeout(() => setCopyFeedback({ show: false, message: '' }), 2000)
  }

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setView('processing')
    setCurrentContract(null)
    setPdfId(null)
    setPdfExpired(false)
    setScrollToPage(null)
    setSelectedContractId(null)
    setSteps(s => s.map(step => ({ ...step, status: 'pending' as const, message: '' })))

    const formData = new FormData()
    formData.append('file', selectedFile)

    const updateStep = (stepIndex: number, status: ProcessingStep['status'], message: string) => {
      setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status, message } : s))
    }

    // Inactivity timeout: if no SSE event arrives within this window, assume failure
    const INACTIVITY_TIMEOUT_MS = 90_000

    try {
      updateStep(0, 'in_progress', 'Checking file...')
      abortControllerRef.current = new AbortController()

      const response = await fetch('/upload-stream', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errData.error || 'Upload failed')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lastEventTime = Date.now()

      while (true) {
        // Race between the next chunk and an inactivity timeout
        const elapsed = Date.now() - lastEventTime
        const remaining = Math.max(INACTIVITY_TIMEOUT_MS - elapsed, 1000)

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(
            'Server stopped responding. The AI analysis may be taking longer than expected. Please try again.'
          )), remaining)
        })

        const { done, value } = await Promise.race([reader.read(), timeoutPromise])
        if (done) break

        lastEventTime = Date.now()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.event === 'step') {
            updateStep(payload.step, payload.status, payload.message)
          } else if (payload.event === 'complete') {
            const result = payload.result
            const savedRecord = saveContract(result)
            setPdfId(result.pdf_id ?? null)
            setCurrentContract(result)
            setSelectedContractId(savedRecord.id)
            setView('detail')
            setFile(null)
          } else if (payload.event === 'error') {
            throw new Error(payload.message)
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setView('empty')
        setFile(null)
        return
      }
      const errorMessage = (err as Error).message || 'An error occurred during processing'
      // Mark the currently in-progress step as errored so user sees which step failed
      setSteps(prev => prev.map(s =>
        s.status === 'in_progress' ? { ...s, status: 'error' as const, message: errorMessage } : s
      ))
      setError(errorMessage)
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') { setError('Please select a PDF file'); return }
    setUploadDialogOpen(false)
    processFile(selectedFile)
  }

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setPdfId(null)
    setPdfExpired(false)
    setScrollToPage(null)
    setFile(null)
    setView('empty')
    setSelectedContractId(null)
    setSteps(s => s.map(step => ({ ...step, status: 'pending' as const, message: '' })))
  }

  const handleSelectContract = (contract: ContractRecord) => {
    const contractPdfId = contract.pdf_id || null
    setCurrentContract({
      parsed_data: contract.parsed_data,
      extracted_info: contract.extracted_info,
      summary: contract.summary,
      pdf_id: contractPdfId,
    })
    setPdfId(contractPdfId)
    setPdfExpired(false)
    setSelectedContractId(contract.id)
    setView('detail')
  }

  const handleDeselectContract = () => {
    setCurrentContract(null)
    setPdfId(null)
    setPdfExpired(false)
    setScrollToPage(null)
    setSelectedContractId(null)
    setView('empty')
  }

  const handleRemoveContract = (contractId: string) => {
    removeContract(contractId)
    if (selectedContractId === contractId) {
      handleDeselectContract()
    }
  }

  const handlePdfUnavailable = useCallback(() => {
    setPdfExpired(true)
    setScrollToPage(null)
  }, [])

  const handleScrollToPage = (page: number) => {
    setScrollToPage(null)
    setTimeout(() => setScrollToPage(page), 50)
  }

  const showPdf = view === 'detail' && (pdfId || pdfExpired)

  return (
    <SidebarProvider>
      <AppSidebar
        contracts={recentContracts}
        selectedId={selectedContractId}
        processingFileName={view === 'processing' ? (file?.name || null) : null}
        onSelectContract={handleSelectContract}
        onRemoveContract={handleRemoveContract}
        onUploadClick={() => setUploadDialogOpen(true)}
        onDeselectContract={handleDeselectContract}
      />
      <SidebarInset className="h-screen overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium">
            {view === 'empty' && 'MSA Extraction Machine'}
            {view === 'processing' && `Processing: ${file?.name || 'document.pdf'}`}
            {view === 'detail' && currentContract && (currentContract.parsed_data.customer_name || 'Contract Review')}
          </span>
        </header>

        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-sm border border-danger-ring bg-danger-bg px-3 py-2 text-xs text-danger-text">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setError(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {view === 'empty' && (
            <div className="w-full">
              <EmptyState onUpload={() => setUploadDialogOpen(true)} />
            </div>
          )}

          {view === 'processing' && (
            <div className="w-full">
              <ProcessingView filename={file?.name || 'document.pdf'} steps={steps} onStop={handleStop} />
            </div>
          )}

          {view === 'detail' && currentContract && (
            <>
              <div className={`overflow-auto ${showPdf ? 'w-1/2 min-w-0' : 'w-full'}`}>
                <ReviewView
                  data={currentContract}
                  pdfId={pdfId}
                  gmailAuth={gmailAuth}
                  onGmailAuthClick={handleGmailAuthClick}
                  onSendEmail={handleSendEmail}
                  onScrollToPage={handleScrollToPage}
                  onCopyFeedback={handleCopyFeedback}
                />
              </div>
              {showPdf && (
                <div className="w-1/2 min-w-0 shrink-0">
                  <PDFViewerPanel pdfId={pdfId} scrollToPage={scrollToPage} onPdfUnavailable={handlePdfUnavailable} />
                </div>
              )}
            </>
          )}
        </div>
      </SidebarInset>

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFileSelect={handleFileSelect}
      />

      {duplicateContract && (
        <DuplicateModal
          contract={duplicateContract}
          onViewExisting={() => { handleSelectContract(duplicateContract); setDuplicateContract(null); setPendingFile(null) }}
          onProcessAnyway={() => { setDuplicateContract(null); if (pendingFile) { processFile(pendingFile); setPendingFile(null) } }}
          onClose={() => { setDuplicateContract(null); setPendingFile(null) }}
        />
      )}

      <CopyFeedback show={copyFeedback.show} message={copyFeedback.message} />
    </SidebarProvider>
  )
}
