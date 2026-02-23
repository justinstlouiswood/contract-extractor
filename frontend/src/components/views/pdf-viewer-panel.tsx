import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type PdfStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'not_found' | 'load_error'

interface PDFViewerPanelProps {
  pdfId: string | null
  scrollToPage: number | null
  onPdfUnavailable?: () => void
}

export function PDFViewerPanel({ pdfId, scrollToPage: targetPage, onPdfUnavailable }: PDFViewerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const renderingRef = useRef<Record<number, boolean>>({})
  const renderGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.75)
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')

  const loadPdf = useCallback(async (id: string, signal: AbortSignal) => {
    // Step 1: Pre-flight check — does the file exist on disk?
    setPdfStatus('checking')
    try {
      const checkResp = await fetch(`/pdf/${id}/check`, { signal })
      if (checkResp.status === 404) {
        // Verify this is actually our check endpoint responding (not a generic 404)
        try {
          const body = await checkResp.json()
          if (body.exists === false) {
            setPdfStatus('not_found')
            onPdfUnavailable?.()
            return
          }
        } catch {
          // Response wasn't JSON — not our endpoint, proceed optimistically
        }
      }
      // Non-404 errors (500, network) — proceed optimistically
    } catch (err) {
      if (signal.aborted) return
      // Check failed (network error) — proceed optimistically to actual load
    }

    if (signal.aborted) return

    // Step 2: Load the PDF document
    setPdfStatus('loading')
    try {
      const pdf = await pdfjsLib.getDocument(`/pdf/${id}`).promise
      if (signal.aborted) return
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setPdfStatus('ready')
    } catch {
      if (signal.aborted) return
      setPdfStatus('load_error')
    }
  }, [onPdfUnavailable])

  useEffect(() => {
    if (!pdfId) {
      setPdfStatus('idle')
      return
    }

    setPdfDoc(null)
    setTotalPages(0)
    renderGenRef.current += 1

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    loadPdf(pdfId, controller.signal)

    return () => { controller.abort() }
  }, [pdfId, loadPdf])

  const handleRetry = useCallback(() => {
    if (!pdfId) return
    setPdfDoc(null)
    setTotalPages(0)
    renderGenRef.current += 1

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    loadPdf(pdfId, controller.signal)
  }, [pdfId, loadPdf])

  const renderPage = useCallback(async (pageNum: number, gen: number) => {
    if (!pdfDoc || !canvasRefs.current[pageNum]) return
    if (renderingRef.current[pageNum]) return
    if (gen !== renderGenRef.current) return

    renderingRef.current[pageNum] = true

    try {
      const page = await pdfDoc.getPage(pageNum)
      if (gen !== renderGenRef.current) return

      const viewport = page.getViewport({ scale })
      const canvas = canvasRefs.current[pageNum]!
      const context = canvas.getContext('2d')!

      canvas.height = viewport.height
      canvas.width = viewport.width

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: context, viewport } as any).promise

      if (gen !== renderGenRef.current) return

      const textContent = await page.getTextContent()
      const textLayerDiv = textLayerRefs.current[pageNum]
      if (textLayerDiv) {
        textLayerDiv.innerHTML = ''
        textLayerDiv.style.width = viewport.width + 'px'
        textLayerDiv.style.height = viewport.height + 'px'

        textContent.items.forEach(item => {
          if (!('str' in item)) return
          const span = document.createElement('span')
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
          span.textContent = item.str
          span.style.position = 'absolute'
          span.style.left = tx[4] + 'px'
          span.style.top = (viewport.height - tx[5]) + 'px'
          span.style.fontSize = Math.abs(tx[0]) + 'px'
          span.style.fontFamily = 'sans-serif'
          span.style.whiteSpace = 'pre'
          span.style.color = 'transparent'
          textLayerDiv.appendChild(span)
        })
      }
    } catch (err) {
      console.warn(`Failed to render page ${pageNum}:`, err)
    } finally {
      renderingRef.current[pageNum] = false
    }
  }, [pdfDoc, scale])

  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return

    renderGenRef.current += 1
    const gen = renderGenRef.current
    renderingRef.current = {}

    const renderAllPages = async () => {
      for (let i = 1; i <= totalPages; i++) {
        if (gen !== renderGenRef.current) return
        await renderPage(i, gen)
      }
    }

    // Small delay to let canvas refs attach after React render
    const timer = setTimeout(renderAllPages, 50)
    return () => clearTimeout(timer)
  }, [pdfDoc, scale, totalPages, renderPage])

  useEffect(() => {
    if (targetPage && containerRef.current) {
      const target = containerRef.current.querySelector(`.pdf-page-wrapper:nth-child(${targetPage})`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [targetPage])

  return (
    <div className="flex h-full flex-col bg-surface-secondary p-3 pl-1.5">
      <div className="flex flex-1 flex-col overflow-hidden rounded-sm border border-border bg-card shadow-card">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold text-muted-foreground">Source Document</span>
          {pdfId && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setScale(s => Math.min(2.5, s + 0.25))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto" ref={containerRef}>
          {!pdfId && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileX className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Source document expired</span>
              <span className="text-sm text-muted-foreground">
                The PDF file is no longer available on the server.
                Re-upload the document to view it alongside the extracted data.
              </span>
            </div>
          )}
          {(pdfStatus === 'checking' || pdfStatus === 'loading') && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pdfStatus === 'checking' ? 'Checking document availability...' : 'Loading document...'}
              </span>
            </div>
          )}

          {pdfStatus === 'not_found' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileX className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Source document expired</span>
              <span className="text-sm text-muted-foreground">
                The PDF file is no longer available on the server.
                Re-upload the document to view it alongside the extracted data.
              </span>
            </div>
          )}

          {pdfStatus === 'load_error' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-sm text-muted-foreground">
                Failed to load the document. This may be a temporary issue.
              </span>
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}

          {pdfStatus === 'ready' && (
            <div className="flex flex-col items-center gap-2 p-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <div key={pageNum} className="pdf-page-wrapper relative overflow-hidden rounded-sm border border-border/50">
                  <canvas ref={el => { canvasRefs.current[pageNum] = el }} className="block max-w-full" />
                  <div ref={el => { textLayerRefs.current[pageNum] = el }} className="absolute inset-0 overflow-hidden" />
                  <div className="py-0.5 text-center text-xs text-muted-foreground">
                    {pageNum} of {totalPages}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
