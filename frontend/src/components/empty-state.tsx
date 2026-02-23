import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onUpload: () => void
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-border bg-card shadow-card">
        <Upload className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Upload an MSA to get started</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drop a PDF contract to extract key terms, fees, and clauses.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onUpload}>
        Upload MSA
      </Button>
    </div>
  )
}
