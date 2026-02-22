import { useState, useEffect, useRef, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface PDFViewerPanelProps {
  pdfUrl: string | null
  scrollToPage: number | null
}

export function PDFViewerPanel({ pdfUrl, scrollToPage: targetPage }: PDFViewerPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const textLayerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const renderingRef = useRef<Record<number, boolean>>({})
  const renderGenRef = useRef(0)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.75)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPdf = useCallback(async (url: string) => {
    try {
      const pdf = await pdfjsLib.getDocument(url).promise
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setLoading(false)
    } catch {
      setError('PDF unavailable')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pdfUrl) return
    setLoading(true)
    setError(null)
    setPdfDoc(null)
    setTotalPages(0)
    renderGenRef.current += 1

    loadPdf(pdfUrl)
  }, [pdfUrl, loadPdf])

  const handleRetry = useCallback(() => {
    if (!pdfUrl) return
    setLoading(true)
    setError(null)
    setPdfDoc(null)
    setTotalPages(0)
    renderGenRef.current += 1
    loadPdf(pdfUrl)
  }, [pdfUrl, loadPdf])

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

  if (!pdfUrl) return null

  return (
    <div className="flex h-full flex-col p-3 pl-1.5">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold text-muted-foreground">Source Document</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setScale(s => Math.min(2.5, s + 0.25))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto" ref={containerRef}>
          {loading && <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading PDF...</div>}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="text-sm text-muted-foreground">{error}</span>
              <span className="text-sm text-muted-foreground">
                The source file may have expired. Re-upload the document to view it.
              </span>
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && (
            <div className="flex flex-col items-center gap-2 p-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <div key={pageNum} className="pdf-page-wrapper relative overflow-hidden rounded-lg border border-border/50">
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
