import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import { FileText, Upload } from 'lucide-react'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  fill?: boolean
}

export function Dropzone({ onFileSelect, fill }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) onFileSelect(e.dataTransfer.files[0])
  }
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) onFileSelect(e.target.files[0])
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          fileInputRef.current?.click()
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-9 text-center transition-colors ${
        fill ? 'h-full' : ''
      } ${
        isDragOver
          ? 'border-text bg-bg-active'
          : 'border-border bg-bg-muted hover:border-text hover:bg-bg-hover'
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg shadow-card">
        <FileText size={18} strokeWidth={1.5} className="text-text-muted" />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-text">
          {isDragOver ? 'Release to upload' : 'Drop your MSA here'}
        </p>
        <p className="text-[11px] text-text-muted">
          PDF only · up to 25 MB
        </p>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-md border border-btn-border bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg shadow-btn transition group-hover:shadow-btn-hover">
        <Upload size={12} strokeWidth={1.75} />
        Browse files
      </span>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf"
        onChange={handleChange}
      />
    </div>
  )
}
