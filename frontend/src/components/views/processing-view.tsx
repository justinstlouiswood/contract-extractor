import { FileText, Check, Square, AlertCircle } from 'lucide-react'
import type { ProcessingStep } from '@/types/contract'

interface ProcessingViewProps {
  filename: string
  steps: ProcessingStep[]
  onStop?: () => void
}

const stepDescriptions: Record<string, string> = {
  'Validating file': 'Checking file type, size, and readability before processing.',
  'Extracting text from PDF': 'Parsing every page to pull raw text and structure from the document.',
  'Analyzing contract with AI': 'Claude reads the full contract and extracts key commercial terms.',
  'Generating summary': 'Building a structured summary with confidence scores for each field.',
}

function ProgressStep({
  number,
  label,
  status,
  message,
}: {
  number: number
  label: string
  status: string
  message: string
}) {
  const description = stepDescriptions[label] || ''

  const indicatorCls =
    status === 'complete'
      ? 'bg-accent text-accent-fg border border-btn-border'
      : status === 'error'
        ? 'border border-danger-border bg-danger-bg text-danger-text'
        : status === 'in_progress'
          ? 'border border-text text-text'
          : 'border border-border-subtle text-text-muted'

  return (
    <div className="flex items-start gap-4 py-3.5">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold ${indicatorCls}`}
      >
        {status === 'complete' ? (
          <Check className="h-4 w-4" />
        ) : status === 'error' ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          number
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-medium ${
            status === 'error' ? 'text-danger-text' : 'text-text'
          }`}
        >
          {label}
        </div>
        <div
          className={`mt-0.5 text-[12px] ${
            status === 'error' ? 'text-danger-text' : 'text-text-muted'
          }`}
        >
          {status === 'in_progress' && message
            ? message
            : status === 'complete' && message
              ? message
              : status === 'error' && message
                ? message
                : description}
        </div>
        {status === 'in_progress' && (
          <div className="mt-2 h-1 overflow-hidden rounded-[2px] bg-bg-active">
            <div className="h-full w-1/3 animate-pulse rounded-[2px] bg-text" />
          </div>
        )}
      </div>
    </div>
  )
}

export function ProcessingView({ filename, steps, onStop }: ProcessingViewProps) {
  const completedSteps = steps.filter((s) => s.status === 'complete').length
  const hasError = steps.some((s) => s.status === 'error')
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-bg-pane px-6">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
          <span className="text-[12px] text-text-muted">{filename}</span>
        </div>

        <div className="divide-y divide-border-subtle">
          {steps.map((step, index) => (
            <ProgressStep
              key={index}
              number={index + 1}
              label={step.label}
              status={step.status}
              message={step.message}
            />
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] ${
                hasError ? 'text-danger-text' : 'text-text-muted'
              }`}
            >
              {hasError ? 'Processing failed' : 'Overall Progress'}
            </span>
            <span
              className={`text-[11px] tabular-nums ${
                hasError ? 'text-danger-text' : 'text-text-muted'
              }`}
            >
              {hasError ? '' : `${Math.round(progress)}%`}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {onStop && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-danger-text hover:bg-danger-bg"
            >
              <Square className="h-3 w-3" />
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
