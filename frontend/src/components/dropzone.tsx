import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import { Upload } from 'lucide-react'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  fill?: boolean
}

export function Dropzone({ onFileSelect, fill }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isHover, setIsHover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) onFileSelect(e.dataTransfer.files[0])
  }
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) onFileSelect(e.target.files[0])
  }

  const isDashedState = isDragOver || isHover

  return (
    <div
      className={`flex cursor-pointer flex-col items-center justify-center rounded-sm p-12 transition-colors ${
        fill ? 'h-full' : ''
      } ${isDashedState ? 'border-2 border-dashed' : 'border border-solid'} ${
        isDragOver
          ? 'border-primary bg-accent'
          : isHover
            ? 'border-muted-foreground bg-transparent'
            : 'border-border bg-card shadow-card'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload className="h-11 w-11 text-muted-foreground" />
      <p className="mt-4 text-base font-medium">Drop your MSA here</p>
      <p className="mt-3 text-sm text-muted-foreground">or click to browse files</p>
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
