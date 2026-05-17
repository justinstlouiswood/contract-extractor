import * as React from 'react'
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Loader2,
  PieChart,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import novistoLogo from '@/assets/novisto.jpg'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/contract-utils'
import type { ContractRecord } from '@/types/contract'

interface AppSidebarProps {
  contracts: ContractRecord[]
  selectedId: string | null
  processingFileName: string | null
  onSelectContract: (contract: ContractRecord) => void
  onRemoveContract: (contractId: string) => void
  onCancelProcessing?: () => void
  onUploadClick: () => void
  onDeselectContract: () => void
}

type NavKey = 'overview' | 'contracts' | 'alerts'
type Bucket = 'review' | 'pending'

function getBucket(contract: ContractRecord): Bucket {
  const confidence = contract.parsed_data.confidence
  if (!confidence) return 'pending'
  const scores = Object.values(confidence)
  if (scores.length === 0) return 'pending'
  const minScore = Math.min(...scores)
  return minScore < 85 ? 'review' : 'pending'
}

function formatListDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AppSidebar({
  contracts,
  selectedId,
  processingFileName,
  onSelectContract,
  onRemoveContract,
  onCancelProcessing,
  onUploadClick,
}: AppSidebarProps) {
  const [activeNav, setActiveNav] = React.useState<NavKey>('contracts')
  const [search, setSearch] = React.useState('')
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set())

  const filtered = React.useMemo(() => {
    if (!search.trim()) return contracts
    const q = search.toLowerCase()
    return contracts.filter((c) =>
      (c.customer_name || '').toLowerCase().includes(q),
    )
  }, [contracts, search])

  const pendingContracts = React.useMemo(
    () => filtered.filter((c) => getBucket(c) === 'pending'),
    [filtered],
  )
  const reviewContracts = React.useMemo(
    () => filtered.filter((c) => getBucket(c) === 'review'),
    [filtered],
  )

  // Prune checked ids that are no longer visible
  React.useEffect(() => {
    setCheckedIds((prev) => {
      const visible = new Set(filtered.map((c) => c.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [filtered])

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearChecked = () => setCheckedIds(new Set())
  const deleteChecked = () => {
    const ids = Array.from(checkedIds)
    ids.forEach((id) => onRemoveContract(id))
    setCheckedIds(new Set())
  }

  const renderContractItem = (contract: ContractRecord) => {
    const isSelected = selectedId === contract.id
    const isChecked = checkedIds.has(contract.id)
    const bucket = getBucket(contract)
    const badgeCls = bucket === 'review' ? 'badge-review' : 'badge-approved'
    const badgeLabel = bucket === 'review' ? 'Review' : 'Approved'

    return (
      <div
        key={contract.id}
        className={`doc-item${isSelected ? ' selected' : ''}${isChecked ? ' checked' : ''}`}
      >
        <div className="doc-checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleChecked(contract.id)}
            aria-label={`Select ${contract.customer_name || 'contract'}`}
            className="size-3.5"
          />
        </div>

        <div
          className="doc-item-clickable"
          role="button"
          tabIndex={0}
          onClick={() => onSelectContract(contract)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectContract(contract)
            }
          }}
        >
          <div className="doc-item-top">
            <span className="doc-name">{contract.customer_name || 'Unknown Customer'}</span>
            <span className={`badge ${badgeCls}`}>{badgeLabel}</span>
          </div>
          <div className="doc-bottom">
            <span className="doc-amount tabular-nums">
              {formatCurrency(contract.total_value)} {contract.currency || ''}
            </span>
            <span className="doc-meta">{formatListDate(contract.date_processed)}</span>
          </div>
        </div>

        <button
          type="button"
          className="doc-row-delete"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveContract(contract.id)
          }}
          aria-label="Delete contract"
          title="Delete contract"
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="workspace-card" role="button">
          <div className="logo-mark">
            <img src={novistoLogo} alt="Novisto" />
          </div>
          <div className="workspace-card-text">
            <span className="workspace-card-name">Novisto</span>
            <span className="workspace-card-sub">MSA Machine · Extraction</span>
          </div>
          <div className="workspace-card-chev">
            <ChevronUp size={11} />
            <ChevronDown size={11} />
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item${activeNav === 'overview' ? ' active' : ''}`}
          onClick={() => setActiveNav('overview')}
        >
          <PieChart size={15} strokeWidth={1.5} />
          Overview
        </button>
        <button
          type="button"
          className={`nav-item${activeNav === 'contracts' ? ' active' : ''}`}
          onClick={() => setActiveNav('contracts')}
        >
          <Folder size={15} strokeWidth={1.5} />
          Contracts
        </button>
        <button
          type="button"
          className={`nav-item${activeNav === 'alerts' ? ' active' : ''}`}
          onClick={() => setActiveNav('alerts')}
        >
          <Bell size={15} strokeWidth={1.5} />
          Alerts
        </button>
      </nav>

      <button type="button" className="upload-btn" onClick={onUploadClick}>
        <Plus size={13} />
        Upload MSA
      </button>

      <div className="search-wrap">
        <input
          className="search-input"
          placeholder="Search contracts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {checkedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span className="tabular-nums">{checkedIds.size} selected</span>
          <div className="bulk-action-bar-actions">
            <button type="button" className="bulk-action-link" onClick={clearChecked}>
              Clear
            </button>
            <button type="button" className="bulk-action-delete" onClick={deleteChecked}>
              <Trash2 size={11} strokeWidth={1.5} />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="doc-list">
        {/* Pending */}
        <div className="doc-section">
          <div className="doc-section-header">
            <span>Pending</span>
            <span className="section-label-count">{pendingContracts.length}</span>
          </div>
          {pendingContracts.length === 0 ? (
            <div className="doc-section-empty">Nothing pending</div>
          ) : (
            pendingContracts.map(renderContractItem)
          )}
        </div>

        {/* Processing */}
        <div className="doc-section">
          <div className="doc-section-header">
            <span>Processing</span>
            <span className="section-label-count">{processingFileName ? 1 : 0}</span>
          </div>
          {processingFileName ? (
            <div className="doc-item processing-item" aria-disabled>
              <div className="doc-item-clickable" style={{ paddingLeft: 12 }}>
                <div className="doc-item-top">
                  <span className="doc-name">
                    <Loader2
                      size={11}
                      strokeWidth={2}
                      className="inline animate-spin text-text-muted"
                      style={{ marginRight: 6, verticalAlign: 'text-bottom' }}
                    />
                    {processingFileName}
                  </span>
                  <span className="badge badge-pending">Processing</span>
                </div>
                <div className="doc-bottom">
                  <span className="doc-amount text-text-muted">Extracting…</span>
                </div>
              </div>
              {onCancelProcessing && (
                <button
                  type="button"
                  className="doc-row-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancelProcessing()
                  }}
                  aria-label="Cancel processing"
                  title="Cancel processing"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ) : (
            <div className="doc-section-empty">No active jobs</div>
          )}
        </div>

        {/* Review */}
        <div className="doc-section">
          <div className="doc-section-header">
            <span>Review</span>
            <span className="section-label-count">{reviewContracts.length}</span>
          </div>
          {reviewContracts.length === 0 ? (
            <div className="doc-section-empty">Nothing to review</div>
          ) : (
            reviewContracts.map(renderContractItem)
          )}
        </div>

        {filtered.length === 0 && !processingFileName && (
          <div className="px-3 py-6 text-center text-[11px] text-text-muted">
            <FileText size={14} strokeWidth={1.5} className="mx-auto mb-2 text-text-muted" />
            Upload an MSA to get started
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        <button type="button" className="nav-item">
          <Settings size={15} strokeWidth={1.5} />
          Settings
        </button>
        <button type="button" className="nav-item">
          <BookOpen size={15} strokeWidth={1.5} />
          Documentation
        </button>
      </div>
    </aside>
  )
}
