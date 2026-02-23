import { FileText, Check, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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

function ProgressStep({ number, label, status, message }: { number: number; label: string; status: string; message: string }) {
  const description = stepDescriptions[label] || ''

  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold ${
        status === 'complete' ? 'bg-foreground text-background' :
        status === 'in_progress' ? 'border border-foreground text-foreground' :
        'border border-border text-muted-foreground'
      }`}>
        {status === 'complete' ? <Check className="h-4 w-4" /> : number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{
          status === 'in_progress' && message ? message :
          status === 'complete' && message ? message :
          description
        }</div>
        {status === 'in_progress' && (
          <div className="mt-2 h-1 overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded bg-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}

export function ProcessingView({ filename, steps, onStop }: ProcessingViewProps) {
  const completedSteps = steps.filter(s => s.status === 'complete').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className="flex h-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-xl">
        {/* Filename header */}
        <div className="mb-5 flex items-center gap-2.5">
          <FileText className="h-4.5 w-4.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{filename}</span>
        </div>

        {/* Steps */}
        <div className="divide-y divide-border">
          {steps.map((step, index) => (
            <ProgressStep key={index} number={index + 1} label={step.label} status={step.status} message={step.message} />
          ))}
        </div>

        {/* Overall progress */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Overall Progress</span>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {onStop && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              className="gap-1.5 text-xs text-danger-text hover:text-danger-text"
            >
              <Square className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
