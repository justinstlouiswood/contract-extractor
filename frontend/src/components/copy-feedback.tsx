interface CopyFeedbackProps {
  show: boolean
  message: string
}

export function CopyFeedback({ show, message }: CopyFeedbackProps) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-btn-border bg-accent px-4 py-2 text-[12px] text-accent-fg shadow-pane animate-in fade-in slide-in-from-bottom-2">
      {message}
    </div>
  )
}
