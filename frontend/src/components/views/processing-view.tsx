import { FileText, Check } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { ProcessingStep } from '@/types/contract'

interface ProcessingViewProps {
  filename: string
  steps: ProcessingStep[]
}

function ProgressStep({ number, label, status, message }: { number: number; label: string; status: string; message: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-xs font-medium ${
        status === 'complete' ? 'bg-foreground text-background' :
        status === 'in_progress' ? 'border border-foreground text-foreground' :
        'border border-border text-muted-foreground'
      }`}>
        {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{label}</div>
        {message && <div className="mt-0.5 text-[11px] text-muted-foreground">{message}</div>}
        {status === 'in_progress' && (
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-muted">
            <div className="h-full w-1/3 animate-pulse rounded bg-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}

export function ProcessingView({ filename, steps }: ProcessingViewProps) {
  const completedSteps = steps.filter(s => s.status === 'complete').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <Card className="rounded-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs">{filename}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y divide-border">
            {steps.map((step, index) => (
              <ProgressStep key={index} number={index + 1} label={step.label} status={step.status} message={step.message} />
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Overall Progress</span>
              <span className="text-[11px] text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
