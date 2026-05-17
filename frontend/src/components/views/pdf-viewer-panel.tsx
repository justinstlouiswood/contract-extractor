import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, FileText, FileX } from 'lucide-react'

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
  filename?: string
}

export function PDFViewerPanel({
  pdfId,
  scrollToPage: targetPage,
  onPdfUnavailable,
  filename,
}: PDFViewerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageWrappersRef = useRef<Record<number, HTMLDivElement | null>>({})
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const renderingRef = useRef<Record<number, boolean>>({})
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const renderGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const programmaticRef = useRef(false)
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null)
  const scale = 1.5

  const loadPdf = useCallback(async (id: string, signal: AbortSignal) => {
    const cached = getCachedPdf(id)
    if (cached) {
      setPdfDoc(cached)
      setTotalPages(cached.numPages)
      setPdfStatus('ready')
      return
    }

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
          // not JSON; proceed optimistically
        }
      }
    } catch {
      if (signal.aborted) return
    }

    if (signal.aborted) return

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
    setCurrentPage(1)
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

        textContent.items.forEach((item) => {
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

  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    pdfDoc.getPage(1).then((page) => {
      const vp = page.getViewport({ scale })
      setPageDimensions({ width: vp.width, height: vp.height })
    })
  }, [pdfDoc, totalPages, scale])

  useEffect(() => {
    if (!pdfDoc || totalPages === 0 || !containerRef.current || !pageDimensions) return

    renderGenRef.current += 1
    const gen = renderGenRef.current
    renderingRef.current = {}
    renderedPagesRef.current.clear()

    const timer = setTimeout(() => {
      renderedPagesRef.current.add(1)
      renderPage(1, gen)
    }, 50)

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const pageNum = parseInt(
            (entry.target as HTMLElement).dataset.pageNum || '0',
            10,
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
      },
    )

    const wrappers = containerRef.current.querySelectorAll('[data-page-num]')
    wrappers.forEach((el) => observerRef.current!.observe(el))

    return () => {
      clearTimeout(timer)
      observerRef.current?.disconnect()
    }
  }, [pdfDoc, scale, totalPages, pageDimensions, renderPage])

  const scrollToPageNumber = useCallback((pageNum: number) => {
    const el = pageWrappersRef.current[pageNum]
    const c = containerRef.current
    if (!el || !c) return

    if (!renderedPagesRef.current.has(pageNum)) {
      renderedPagesRef.current.add(pageNum)
      renderPage(pageNum, renderGenRef.current)
    }

    programmaticRef.current = true
    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current)
    const top = el.offsetTop - 16
    c.scrollTo({ top, behavior: 'smooth' })
    setCurrentPage(pageNum)
    programmaticTimerRef.current = setTimeout(() => {
      programmaticRef.current = false
    }, 900)
  }, [renderPage])

  useEffect(() => {
    if (targetPage) scrollToPageNumber(targetPage)
  }, [targetPage, scrollToPageNumber])

  const handleScroll = useCallback(() => {
    if (programmaticRef.current) return
    const c = containerRef.current
    if (!c || totalPages === 0) return

    requestAnimationFrame(() => {
      const scrollTop = c.scrollTop
      let closest = currentPage
      let minDist = Infinity
      for (let p = 1; p <= totalPages; p++) {
        const el = pageWrappersRef.current[p]
        if (!el) continue
        const dist = Math.abs(el.offsetTop - scrollTop - 24)
        if (dist < minDist) {
          minDist = dist
          closest = p
        }
      }
      if (closest !== currentPage) setCurrentPage(closest)
    })
  }, [currentPage, totalPages])

  const displayName = filename || (pdfId ? `${pdfId.slice(0, 8)}.pdf` : 'document.pdf')

  return (
    <div className="pdf-col">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <FileText size={13} strokeWidth={1.5} className="text-text-muted" />
          <span className="pdf-toolbar-title">{displayName}</span>
        </div>
        {pdfStatus === 'ready' && totalPages > 0 && (
          <div className="pdf-toolbar-pager">
            <button
              type="button"
              className="pdf-pager-btn"
              onClick={() => scrollToPageNumber(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={11} />
            </button>
            <span className="text-text font-medium tabular-nums">{currentPage}</span>
            <span className="text-text-muted tabular-nums">/ {totalPages}</span>
            <button
              type="button"
              className="pdf-pager-btn"
              onClick={() => scrollToPageNumber(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="pdf-scroll" ref={containerRef} onScroll={handleScroll}>
        {!pdfId && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileX className="h-8 w-8 text-text-muted" />
            <span className="text-sm font-medium text-text">Source document expired</span>
            <span className="text-[12px] text-text-muted">
              The PDF file is no longer available on the server. Re-upload the document to view it alongside the extracted data.
            </span>
          </div>
        )}

        {(pdfStatus === 'checking' || pdfStatus === 'loading') && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text" />
            <span className="text-[12px] text-text-muted">
              {pdfStatus === 'checking' ? 'Checking document availability…' : 'Loading document…'}
            </span>
          </div>
        )}

        {pdfStatus === 'not_found' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileX className="h-8 w-8 text-text-muted" />
            <span className="text-sm font-medium text-text">Source document expired</span>
            <span className="text-[12px] text-text-muted">
              The PDF file is no longer available on the server. Re-upload the document to view it alongside the extracted data.
            </span>
          </div>
        )}

        {pdfStatus === 'load_error' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-[12px] text-text-muted">
              Failed to load the document. This may be a temporary issue.
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md border border-btn-border bg-bg px-3 py-1.5 text-[12px] text-text-default shadow-btn hover:shadow-btn-hover"
            >
              Retry
            </button>
          </div>
        )}

        {pdfStatus === 'ready' &&
          Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              data-page-num={pageNum}
              ref={(el) => { pageWrappersRef.current[pageNum] = el }}
              className={`pdf-page${pageNum === currentPage ? ' is-current' : ''}`}
              style={pageDimensions ? { minHeight: pageDimensions.height } : undefined}
            >
              <canvas
                ref={(el) => { canvasRefs.current[pageNum] = el }}
                className="block max-w-full"
              />
              <div
                ref={(el) => { textLayerRefs.current[pageNum] = el }}
                className="absolute inset-0 overflow-hidden"
              />
              <div className="py-0.5 text-center text-[10px] text-text-muted tabular-nums">
                {pageNum} / {totalPages}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
