import * as React from 'react'
import { FileText, Inbox, Upload, Archive, X } from 'lucide-react'
import novistoLogo from '@/assets/novisto.jpg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { formatCurrency } from '@/lib/contract-utils'
import type { ContractRecord } from '@/types/contract'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  contracts: ContractRecord[]
  selectedId: string | null
  processingFileName: string | null
  onSelectContract: (contract: ContractRecord) => void
  onRemoveContract: (contractId: string) => void
  onUploadClick: () => void
  onDeselectContract: () => void
}

type NavSection = 'inbox' | 'processed'

function getContractStatus(contract: ContractRecord): 'extracted' | 'needs_review' {
  const confidence = contract.parsed_data.confidence
  if (!confidence) return 'extracted'
  const scores = Object.values(confidence)
  if (scores.length === 0) return 'extracted'
  const minScore = Math.min(...scores)
  return minScore < 85 ? 'needs_review' : 'extracted'
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
  onUploadClick,
  onDeselectContract,
  ...props
}: AppSidebarProps) {
  const [activeNav, setActiveNav] = React.useState<NavSection>('inbox')
  const { setOpen } = useSidebar()

  const navItems = [
    { key: 'inbox' as const, label: 'Inbox', icon: Inbox },
    { key: 'processed' as const, label: 'Processing', icon: Archive },
  ]

  // All contracts in inbox, processed is a subset of those fully verified
  // For now, inbox shows all contracts
  const displayContracts = activeNav === 'inbox'
    ? contracts
    : contracts.filter(c => getContractStatus(c) === 'extracted')

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* Icon rail (inner sidebar, non-collapsible) */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="md:h-8 md:p-0"
                tooltip={{ children: 'MSA Extraction Machine', hidden: false }}
              >
                <img src={novistoLogo} alt="Novisto logo" className="h-8 w-8 rounded-sm object-contain" />
                <span className="truncate text-sm font-medium">MSA Machine</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={{ children: item.label, hidden: false }}
                      onClick={() => {
                        setActiveNav(item.key)
                        setOpen(true)
                      }}
                      isActive={activeNav === item.key}
                      className={`px-2.5 md:px-2 ${activeNav === item.key ? 'border-l-2 border-l-foreground' : ''}`}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* MSA list sidebar (collapsible content pane) */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm font-medium text-foreground">
              {activeNav === 'inbox' ? 'All Contracts' : 'Processing'}
            </div>
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {displayContracts.length}
            </Badge>
          </div>
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={onUploadClick}
          >
            <Upload className="size-3.5" />
            Upload MSA
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            {processingFileName && (
              <>
                <SidebarGroupLabel className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Processing
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <button
                    className="flex w-full flex-col items-start gap-1.5 border-b p-4 text-sm"
                  >
                    <div className="flex w-full items-center gap-2">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{processingFileName}</span>
                    </div>
                    <div className="flex w-full items-center gap-2 pl-5.5">
                      <Badge variant="warning" className="text-[10px]">
                        Processing
                      </Badge>
                    </div>
                  </button>
                </SidebarGroupContent>
                <SidebarSeparator />
              </>
            )}
            <SidebarGroupContent>
              {displayContracts.length === 0 && !processingFileName && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No contracts yet
                </div>
              )}
              {displayContracts.map((contract) => {
                const status = getContractStatus(contract)
                const isSelected = selectedId === contract.id

                return (
                  <div
                    key={contract.id}
                    className={`group relative flex w-full border-b last:border-b-0 ${
                      isSelected
                        ? 'border-l-2 border-l-foreground bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <button
                      onClick={() => onSelectContract(contract)}
                      className="flex w-full flex-col items-start gap-1.5 p-4 text-left text-sm transition-colors"
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="truncate font-medium">
                          {contract.customer_name || 'Unknown Customer'}
                        </span>
                      </div>
                      <div className="flex w-full items-center gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(contract.total_value)} {contract.currency}
                        </span>
                        <Badge
                          variant={status === 'needs_review' ? 'warning' : 'extracted'}
                          className="ml-auto text-[10px]"
                        >
                          {status === 'needs_review' ? 'Needs Review' : 'Extracted'}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatListDate(contract.date_processed)}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveContract(contract.id) }}
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-sidebar-accent group-hover:opacity-100"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
