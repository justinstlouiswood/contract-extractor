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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload MSA</DialogTitle>
          <DialogDescription>
            Drop a PDF contract or click to browse files.
          </DialogDescription>
        </DialogHeader>
        <Dropzone onFileSelect={handleFileSelect} />
      </DialogContent>
    </Dialog>
  )
}
