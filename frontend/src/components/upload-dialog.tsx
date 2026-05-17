import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Dropzone } from '@/components/dropzone'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect: (file: File) => void
}

export function UploadDialog({ open, onOpenChange, onFileSelect }: UploadDialogProps) {
  const handleFileSelect = (file: File) => {
    onFileSelect(file)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-5 sm:max-w-md">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em] text-text">
            Upload MSA
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-muted">
            Drop a PDF contract or click to browse files.
          </DialogDescription>
        </DialogHeader>
        <Dropzone onFileSelect={handleFileSelect} />
      </DialogContent>
    </Dialog>
  )
}
