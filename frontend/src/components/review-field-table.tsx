import { MoreHorizontal } from 'lucide-react'
import { PageRefPill } from '@/components/page-ref-pill'
import { getPageRef } from '@/lib/contract-utils'
import type { ParsedData, VerifiableField } from '@/types/contract'

function resolveConfidence(confidence: Record<string, number>, fieldKey: string): number | null {
  if (confidence[fieldKey] !== undefined) return confidence[fieldKey]
  if (fieldKey.startsWith('annual_fee_year_')) return confidence['annual_fees'] ?? null
  if (fieldKey.startsWith('point_of_contact_')) return confidence['point_of_contact'] ?? null
  if (fieldKey.startsWith('billing_contact_')) return confidence['billing_contact'] ?? null
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
  fields, parsed_data, confidence,
  editingField, editValue, editedFields,
  onActivate, onScrollToPage, onStartEdit, onSaveEdit, onCancelEdit, onEditChange,
}: ReviewFieldTableProps) {
  if (fields.length === 0) {
    return (
      <div className="px-5 py-4 text-center text-[11px] text-text-muted">
        No fields extracted for this section.
      </div>
    )
  }

  return (
    <table className="extract-table">
      <thead>
        <tr>
          <th style={{ width: '36%' }}>Field</th>
          <th>Value</th>
          <th>Page</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => {
          const isEditing = editingField === field.key
          const displayValue =
            editedFields[field.key] !== undefined ? editedFields[field.key] : field.value
          const pageRefs = getPageRef(parsed_data, field.key)
          const fieldConfidence = confidence ? resolveConfidence(confidence, field.key) : null
          const needsReview = fieldConfidence !== null && fieldConfidence < 85

          return (
            <tr
              key={field.key}
              onClick={() => onActivate(field.key)}
              style={{ cursor: 'pointer' }}
            >
              <td className="field-name">
                {field.label}
              </td>
              <td className="field-val">
                {isEditing ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="h-7 flex-1 rounded-md border border-border-subtle bg-bg px-2 text-[12px] outline-none focus:border-border"
                      value={editValue}
                      autoFocus
                      onChange={(e) => onEditChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveEdit(field.key)
                        if (e.key === 'Escape') onCancelEdit()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onSaveEdit(field.key)}
                      className="px-2 text-[11px] font-medium text-text hover:text-text"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="px-2 text-[11px] text-text-muted hover:text-text"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {field.isLink ? (
                      <a
                        href={`mailto:${displayValue}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {displayValue}
                      </a>
                    ) : (
                      <span>{displayValue || '—'}</span>
                    )}
                    {needsReview && <span className="badge badge-review">Review</span>}
                    {editedFields[field.key] !== undefined && (
                      <span className="badge badge-neutral">Edited</span>
                    )}
                  </div>
                )}
              </td>
              <td>
                <div className="td-actions">
                  <PageRefPill pages={pageRefs} onClick={onScrollToPage} />
                  {!isEditing && (
                    <button
                      type="button"
                      className="edit-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStartEdit(field.key, displayValue)
                      }}
                      aria-label="Edit field"
                    >
                      <MoreHorizontal size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
