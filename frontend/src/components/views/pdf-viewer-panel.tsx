import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Dynamic import of pdfjs-dist — keeps ~1MB out of the main bundle
type PdfjsLib = typeof import('pdfjs-dist')
let _pdfjsLib: PdfjsLib | null = null

async function loadPdfjsLib(): Promise<PdfjsLib> {
  if (_pdfjsLib) return _pdfjsLib
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  _pdfjsLib = lib
  return lib
}

function getPdfjsLib(): PdfjsLib | null {
  return _pdfjsLib
}

// Module-level PDF document cache (max 5 entries, LRU eviction)
type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy
const pdfDocCache = new Map<string, PDFDocumentProxy>()
const PDF_CACHE_MAX = 5

function getCachedPdf(id: string): PDFDocumentProxy | undefined {
  return pdfDocCache.get(id)
}

function cachePdf(id: string, doc: PDFDocumentProxy): void {
  if (pdfDocCache.size >= PDF_CACHE_MAX) {
    const firstKey = pdfDocCache.keys().next().value
    if (firstKey) {
      pdfDocCache.get(firstKey)?.destroy()
      pdfDocCache.delete(firstKey)
    }
  }
  pdfDocCache.set(id, doc)
}

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
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const renderGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.75)
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null)

  const loadPdf = useCallback(async (id: string, signal: AbortSignal) => {
    // Check module-level cache first
    const cached = getCachedPdf(id)
    if (cached) {
      setPdfDoc(cached)
      setTotalPages(cached.numPages)
      setPdfStatus('ready')
      return
    }

    // Step 1: Pre-flight check — does the file exist on disk?
    setPdfStatus('checking')
    try {
      const checkResp = await fetch(`/pdf/${id}/check`, { signal })
      if (checkResp.status === 404) {
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
    } catch (err) {
      if (signal.aborted) return
    }

    if (signal.aborted) return

    // Step 2: Load pdfjs library (dynamic import, cached after first load)
    setPdfStatus('loading')
    let lib: PdfjsLib
    try {
      lib = await loadPdfjsLib()
    } catch {
      if (signal.aborted) return
      setPdfStatus('load_error')
      return
    }

    if (signal.aborted) return

    // Step 3: Load the PDF document
    try {
      const pdf = await lib.getDocument(`/pdf/${id}`).promise
      if (signal.aborted) return
      cachePdf(id, pdf)
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
    setPageDimensions(null)
    renderGenRef.current += 1
    renderedPagesRef.current.clear()

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
    setPageDimensions(null)
    renderGenRef.current += 1
    renderedPagesRef.current.clear()

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    loadPdf(pdfId, controller.signal)
  }, [pdfId, loadPdf])

  const renderPage = useCallback(async (pageNum: number, gen: number) => {
    const lib = getPdfjsLib()
    if (!lib || !pdfDoc || !canvasRefs.current[pageNum]) return
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
          const tx = lib.Util.transform(viewport.transform, item.transform)
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

  // Compute default page dimensions from page 1 for placeholders
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    pdfDoc.getPage(1).then(page => {
      const vp = page.getViewport({ scale })
      setPageDimensions({ width: vp.width, height: vp.height })
    })
  }, [pdfDoc, totalPages, scale])

  // IntersectionObserver-based lazy rendering
  useEffect(() => {
    if (!pdfDoc || totalPages === 0 || !containerRef.current || !pageDimensions) return

    renderGenRef.current += 1
    const gen = renderGenRef.current
    renderingRef.current = {}
    renderedPagesRef.current.clear()

    // Render page 1 immediately for fast first paint
    const timer = setTimeout(() => {
      renderedPagesRef.current.add(1)
      renderPage(1, gen)
    }, 50)

    // Set up observer for remaining pages
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const pageNum = parseInt(
            (entry.target as HTMLElement).dataset.pageNum || '0', 10
          )
          if (pageNum > 0 && !renderedPagesRef.current.has(pageNum)) {
            renderedPagesRef.current.add(pageNum)
            renderPage(pageNum, renderGenRef.current)
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: '200px 0px',
      }
    )

    // Observe all page wrappers
    const wrappers = containerRef.current.querySelectorAll('[data-page-num]')
    wrappers.forEach(el => observerRef.current!.observe(el))

    return () => {
      clearTimeout(timer)
      observerRef.current?.disconnect()
    }
  }, [pdfDoc, scale, totalPages, pageDimensions, renderPage])

  // Scroll-to-page: also pre-render the target page
  useEffect(() => {
    if (targetPage && containerRef.current) {
      // Pre-render the target page so it's not blank when scrolled into view
      if (!renderedPagesRef.current.has(targetPage)) {
        renderedPagesRef.current.add(targetPage)
        renderPage(targetPage, renderGenRef.current)
      }
      const target = containerRef.current.querySelector(`[data-page-num="${targetPage}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [targetPage, renderPage])

  return (
    <div className="flex h-full flex-col bg-background p-3 pl-1.5">
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
                <div
                  key={pageNum}
                  data-page-num={pageNum}
                  className="pdf-page-wrapper relative overflow-hidden rounded-sm border border-border/50"
                  style={pageDimensions ? { minHeight: pageDimensions.height, width: pageDimensions.width } : undefined}
                >
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
