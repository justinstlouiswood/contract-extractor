import { useState, useEffect, useRef } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingDock } from '@/components/floating-dock'
import { ThemeToggle } from '@/components/theme-toggle'
import { CopyFeedback } from '@/components/copy-feedback'
import { HomeView } from '@/components/views/home-view'
import { ProcessingView } from '@/components/views/processing-view'
import { ReviewView } from '@/components/views/review-view'
import { PDFViewerPanel } from '@/components/views/pdf-viewer-panel'
import { DuplicateModal } from '@/components/views/duplicate-modal'
import { useTheme } from '@/hooks/use-theme'
import { useRecentContracts } from '@/hooks/use-recent-contracts'
import type { AppView, ContractResult, ContractRecord, GmailAuth, ProcessingStep } from '@/types/contract'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const { contracts: recentContracts, save: saveContract, clear: clearContracts } = useRecentContracts()

  const [view, setView] = useState<AppView>('home')
  const [currentContract, setCurrentContract] = useState<ContractResult | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState({ show: false, message: '' })
  const [duplicateContract, setDuplicateContract] = useState<ContractRecord | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Validating file', status: 'pending', message: '' },
    { label: 'Extracting text from PDF', status: 'pending', message: '' },
    { label: 'Analyzing contract with AI', status: 'pending', message: '' },
    { label: 'Generating summary', status: 'pending', message: '' },
  ])
  const [gmailAuth, setGmailAuth] = useState<GmailAuth>({ authenticated: false, email: null })
  const [pdfId, setPdfId] = useState<string | null>(null)
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
    setSteps(s => s.map(step => ({ ...step, status: 'pending' as const, message: '' })))

    const formData = new FormData()
    formData.append('file', selectedFile)

    const updateStep = (stepIndex: number, status: ProcessingStep['status'], message: string) => {
      setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status, message } : s))
    }

    try {
      updateStep(0, 'in_progress', 'Checking file...')
      await new Promise(r => setTimeout(r, 500))
      updateStep(0, 'complete', 'File validated')

      updateStep(1, 'in_progress', 'Reading PDF content...')
      abortControllerRef.current = new AbortController()

      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      updateStep(1, 'complete', 'Text extracted')
      updateStep(2, 'in_progress', 'Claude is analyzing the contract...')
      await new Promise(r => setTimeout(r, 300))
      updateStep(2, 'complete', 'Analysis complete')
      updateStep(3, 'in_progress', 'Preparing summary...')

      const result = await response.json()
      if (result.error) throw new Error(result.error)

      updateStep(3, 'complete', 'Summary generated')
      await new Promise(r => setTimeout(r, 500))

      saveContract(result)
      if (result.pdf_id) setPdfId(result.pdf_id)
      setCurrentContract(result)
      setView('detail')
    } catch (err) {
      if ((err as Error).name === 'AbortError') { setView('home'); return }
      setError((err as Error).message || 'An error occurred during processing')
      setView('home')
    }
  }

  const handleFileSelect = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') { setError('Please select a PDF file'); return }
    processFile(selectedFile)
  }

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setView('home')
    setSteps(s => s.map(step => ({ ...step, status: 'pending' as const, message: '' })))
  }

  const handleSelectContract = (contract: ContractRecord) => {
    setCurrentContract({
      parsed_data: contract.parsed_data,
      extracted_info: contract.extracted_info,
      summary: contract.summary,
    })
    setPdfId(contract.pdf_id || null)
    setView('detail')
  }

  const handleBack = () => {
    setCurrentContract(null)
    setPdfId(null)
    setScrollToPage(null)
    setView('home')
  }

  const handleScrollToPage = (page: number) => {
    setScrollToPage(null)
    setTimeout(() => setScrollToPage(page), 50)
  }

  const showDock = view !== 'home'
  const getStatus = (): 'processing' | 'complete' | null => {
    if (view === 'processing') return 'processing'
    if (view === 'detail') return 'complete'
    return null
  }

  const showPdf = view === 'detail' && pdfId

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="fixed top-3 right-3 z-40">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {showDock && (
        <FloatingDock
          status={getStatus()}
          onBack={handleBack}
          onStop={handleStop}
          onConfirmComplete={handleBack}
          onRejectComplete={() => {}}
        />
      )}

      <main className="flex flex-1 justify-center overflow-hidden bg-background">
        <div className={`flex ${showPdf ? 'max-w-[2000px]' : 'max-w-[1200px]'} w-full`}>
          <div className={`overflow-auto ${showPdf ? 'w-1/2 min-w-0' : 'w-full'}`}>
            {error && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-sm border border-danger-ring bg-danger-bg px-3 py-2 text-xs text-danger-text">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setError(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {view === 'home' && (
              <HomeView
                recentContracts={recentContracts}
                onFileSelect={handleFileSelect}
                onSelectContract={handleSelectContract}
                onClearRecents={clearContracts}
              />
            )}

            {view === 'processing' && (
              <ProcessingView filename={file?.name || 'document.pdf'} steps={steps} />
            )}

            {view === 'detail' && currentContract && (
              <ReviewView
                data={currentContract}
                pdfId={pdfId}
                gmailAuth={gmailAuth}
                onGmailAuthClick={handleGmailAuthClick}
                onSendEmail={handleSendEmail}
                onScrollToPage={handleScrollToPage}
                onCopyFeedback={handleCopyFeedback}
              />
            )}
          </div>

          {showPdf && (
            <div className="w-1/2 min-w-0 shrink-0">
              <PDFViewerPanel pdfId={pdfId} scrollToPage={scrollToPage} />
            </div>
          )}
        </div>
      </main>

      {duplicateContract && (
        <DuplicateModal
          contract={duplicateContract}
          onViewExisting={() => { handleSelectContract(duplicateContract); setDuplicateContract(null); setPendingFile(null) }}
          onProcessAnyway={() => { setDuplicateContract(null); if (pendingFile) { processFile(pendingFile); setPendingFile(null) } }}
          onClose={() => { setDuplicateContract(null); setPendingFile(null) }}
        />
      )}

      <CopyFeedback show={copyFeedback.show} message={copyFeedback.message} />
    </div>
  )
}
