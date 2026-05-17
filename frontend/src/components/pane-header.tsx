import { ChevronRight, Folder } from 'lucide-react'

interface PaneHeaderProps {
  breadcrumbCurrent: string | null
}

export function PaneHeader({ breadcrumbCurrent }: PaneHeaderProps) {
  return (
    <div className="pane-header">
      <div className="breadcrumb">
        <Folder size={13} strokeWidth={1.5} />
        <span>Contracts</span>
        {breadcrumbCurrent && (
          <>
            <ChevronRight size={11} strokeWidth={1.5} />
            <span className="breadcrumb-current">{breadcrumbCurrent}</span>
          </>
        )}
      </div>
    </div>
  )
}
