import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageRefPill } from '@/components/page-ref-pill'
import { getPageRef } from '@/lib/contract-utils'
import type { ParsedData, VerifiableField } from '@/types/contract'

/**
 * Maps individual field keys to their parent confidence keys.
 * e.g. annual_fee_year_1 → annual_fees, point_of_contact_name → point_of_contact
 */
function resolveConfidence(confidence: Record<string, number>, fieldKey: string): number | null {
  // Direct match
  if (confidence[fieldKey] !== undefined) return confidence[fieldKey]

  // annual_fee_year_N → annual_fees
  if (fieldKey.startsWith('annual_fee_year_')) {
    return confidence['annual_fees'] ?? null
  }

  // point_of_contact_name/email → point_of_contact
  if (fieldKey.startsWith('point_of_contact_')) {
    return confidence['point_of_contact'] ?? null
  }

  // billing_contact_name/email → billing_contact
  if (fieldKey.startsWith('billing_contact_')) {
    return confidence['billing_contact'] ?? null
  }

  // signature_customer/vendor → signature_customer/signature_vendor
  // (these should match directly, but fall back to parent)
  if (fieldKey === 'signature_customer') {
    return confidence['signature_customer'] ?? null
  }
  if (fieldKey === 'signature_vendor') {
    return confidence['signature_vendor'] ?? null
  }

  return null
}

interface ReviewFieldTableProps {
  fields: VerifiableField[]
  parsed_data: ParsedData
  activeField: string | null
  confidence?: Record<string, number>
  editingField: string | null
  editValue: string
  editedFields: Record<string, string>
  onActivate: (key: string) => void
  onScrollToPage: (page: number) => void
  onStartEdit: (key: string, value: string) => void
  onSaveEdit: (key: string) => void
  onCancelEdit: () => void
  onEditChange: (value: string) => void
}

export function ReviewFieldTable({
  fields, parsed_data, activeField, confidence,
  editingField, editValue, editedFields,
  onActivate, onScrollToPage, onStartEdit, onSaveEdit, onCancelEdit, onEditChange,
}: ReviewFieldTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-7 w-[30%] px-2 text-xs font-medium text-muted-foreground">Field</TableHead>
          <TableHead className="h-7 px-2 text-xs font-medium text-muted-foreground">Value</TableHead>
          <TableHead className="h-7 w-[48px] px-1 text-xs font-medium text-muted-foreground">Page</TableHead>
          <TableHead className="h-7 w-8 px-1"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="px-2 py-4 text-center text-xs text-muted-foreground">
              No fields extracted for this section.
            </TableCell>
          </TableRow>
        )}
        {fields.map(field => {
          const isEditing = editingField === field.key
          const displayValue = editedFields[field.key] !== undefined ? editedFields[field.key] : field.value
          const pageRefs = getPageRef(parsed_data, field.key)
          const isActive = activeField === field.key

          // Confidence lookup with parent-key mapping
          const fieldConfidence = confidence
            ? resolveConfidence(confidence, field.key)
            : null
          const needsReview = fieldConfidence !== null && fieldConfidence < 85

          return (
            <TableRow
              key={field.key}
              className={`cursor-pointer ${isActive ? 'bg-accent' : ''}`}
              onClick={() => onActivate(field.key)}
            >
              <TableCell className="px-2 py-1 text-xs text-muted-foreground">
                {field.label}
                {needsReview && (
                  <Badge variant="review" className="ml-1.5 text-xs">Review</Badge>
                )}
              </TableCell>
              <TableCell className="px-2 py-1">
                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Input
                      value={editValue}
                      onChange={e => onEditChange(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(field.key); if (e.key === 'Escape') onCancelEdit() }}
                    />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onSaveEdit(field.key)}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onCancelEdit}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {field.isLink ? (
                      <a
                        href={`mailto:${displayValue}`}
                        className="text-xs underline underline-offset-2"
                        onClick={e => e.stopPropagation()}
                      >
                        {displayValue}
                      </a>
                    ) : (
                      <span className="text-xs">{displayValue || '\u2014'}</span>
                    )}
                    {editedFields[field.key] !== undefined && (
                      <span className="rounded-md bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground">
                        Edited
                      </span>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="px-1 py-1">
                <PageRefPill pages={pageRefs} onClick={onScrollToPage} />
              </TableCell>
              <TableCell className="px-1 py-1" onClick={e => e.stopPropagation()}>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const dv = editedFields[field.key] !== undefined ? editedFields[field.key] : field.value
                      onStartEdit(field.key, dv)
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
