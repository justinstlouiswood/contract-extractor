import { useState, useMemo } from 'react'
import { ArrowUpDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/contract-utils'
import type { ContractRecord } from '@/types/contract'

const PAGE_SIZE = 10

interface HomeContractTableProps {
  contracts: ContractRecord[]
  onSelect: (contract: ContractRecord) => void
  onClear: () => void
}

type SortKey = 'customer_name' | 'total_value' | 'date_processed' | 'duration'
type SortDir = 'asc' | 'desc' | null

export function HomeContractTable({ contracts, onSelect, onClear }: HomeContractTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  if (contracts.length === 0) return null

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts
    const q = search.toLowerCase()
    return contracts.filter(c =>
      c.customer_name.toLowerCase().includes(q) ||
      c.parsed_data?.duration?.toLowerCase().includes(q)
    )
  }, [contracts, search])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      let aVal: string | number = '', bVal: string | number = ''
      if (sortKey === 'customer_name') { aVal = a.customer_name; bVal = b.customer_name }
      else if (sortKey === 'total_value') { aVal = a.total_value; bVal = b.total_value }
      else if (sortKey === 'date_processed') { aVal = a.date_processed; bVal = b.date_processed }
      else if (sortKey === 'duration') { aVal = a.parsed_data?.duration || ''; bVal = b.parsed_data?.duration || '' }

      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </Button>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Extractions</h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onClear}>
          Clear
        </Button>
      </div>

      {contracts.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="h-9 pl-8 pr-8 text-sm"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
              onClick={() => { setSearch(''); setPage(1) }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      <div className="rounded-sm border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 w-[30%]"><SortHeader label="Customer" field="customer_name" /></TableHead>
              <TableHead className="h-8 w-[15%]"><SortHeader label="Duration" field="duration" /></TableHead>
              <TableHead className="h-8 w-[20%]"><SortHeader label="Total Value" field="total_value" /></TableHead>
              <TableHead className="h-8 w-[20%]"><SortHeader label="Extracted" field="date_processed" /></TableHead>
              <TableHead className="h-8 w-[15%] text-sm font-medium text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                  No contracts found
                </TableCell>
              </TableRow>
            ) : (
              paged.map(contract => (
                <TableRow
                  key={contract.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(contract)}
                >
                  <TableCell className="py-2.5 text-sm font-medium">{contract.customer_name}</TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground">{contract.parsed_data?.duration || '\u2014'}</TableCell>
                  <TableCell className="py-2.5 text-sm tabular-nums">
                    {contract.total_value > 0 ? `${formatCurrency(contract.total_value)} ${contract.currency}` : '\u2014'}
                  </TableCell>
                  <TableCell className="py-2.5 text-sm text-muted-foreground">
                    {contract.date_processed ? new Date(contract.date_processed).toLocaleDateString() : '\u2014'}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="extracted" className="text-xs">Extracted</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="sm"
              className="h-7 w-7 p-0 text-xs"
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
