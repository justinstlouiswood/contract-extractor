import { Upload } from 'lucide-react'

interface EmptyStateProps {
  onUpload: () => void
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border-subtle bg-bg shadow-card">
        <Upload className="h-6 w-6 text-text-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text">Upload an MSA to get started</p>
        <p className="mt-1 text-[12px] text-text-muted">
          Drop a PDF contract to extract key terms, fees, and clauses.
        </p>
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="inline-flex items-center gap-2 rounded-md border border-btn-border bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg shadow-btn transition hover:shadow-btn-hover"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload MSA
      </button>
    </div>
  )
}
