import React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check, RotateCcw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { SORTABLE_KEYS, getSortDirections } from '@/lib/sheetSort'

/**
 * Enhanced table header cell for spreadsheet sheets.
 * Provides both 1-click header cycling (Asc → Desc → Default)
 * and an explicit dropdown menu for choosing order (e.g. A-Z, Earliest/Closest date, etc.).
 */
export function SortableHeaderCell({
  column,
  clientSort,
  onSortChange,
  isFirst = false,
  className = '',
}) {
  const isSortable = SORTABLE_KEYS.has(column.key)
  const isActive = clientSort?.key === column.key
  const activeDir = isActive ? clientSort.dir : null
  const directions = getSortDirections(column.key)

  const handleHeaderClick = (e) => {
    // If clicking inside the dropdown button, let dropdown handle it
    if (e.target.closest('[data-dropdown-trigger="true"]')) return

    if (!isSortable) return
    if (!isActive) {
      onSortChange(column.key, 'asc')
    } else if (activeDir === 'asc') {
      onSortChange(column.key, 'desc')
    } else {
      onSortChange(null, 'asc')
    }
  }

  const SortIcon = isActive
    ? (activeDir === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown

  return (
    <th
      style={{ minWidth: column.minWidth }}
      onClick={isSortable ? handleHeaderClick : undefined}
      className={`p-3 border-r border-border text-[11px] font-bold uppercase tracking-wider whitespace-nowrap select-none transition-colors ${
        isFirst
          ? 'sticky left-0 z-20 bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.15)]'
          : ''
      } ${
        isSortable ? 'cursor-pointer hover:bg-muted/70 group/th' : ''
      } ${
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
      } ${className}`}
      title={
        isSortable
          ? isActive
            ? `Current: ${activeDir === 'asc' ? directions.asc : directions.desc} (Click to toggle)`
            : `Sort by ${column.label}`
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 transition-colors ${
            isActive ? 'text-primary font-extrabold' : 'group-hover/th:text-foreground'
          }`}
        >
          <span>{column.label}</span>
          {isSortable && (
            <SortIcon
              className={`size-3 shrink-0 transition-all ${
                isActive
                  ? 'text-primary opacity-100'
                  : 'text-muted-foreground/35 opacity-0 group-hover/th:opacity-100 group-hover/th:text-muted-foreground'
              }`}
            />
          )}
        </span>

        {isSortable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-dropdown-trigger="true"
                onClick={(e) => e.stopPropagation()}
                className={`p-0.5 rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-opacity ${
                  isActive ? 'opacity-100 text-primary' : 'opacity-0 group-hover/th:opacity-100'
                }`}
                title={`Sort options for ${column.label}`}
                aria-label={`Sort options for ${column.label}`}
              >
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Sort: {column.label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center justify-between cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault()
                  onSortChange(column.key, 'asc')
                }}
              >
                <span className="font-medium">{directions.asc}</span>
                {isActive && activeDir === 'asc' && (
                  <Check className="size-3.5 text-primary ml-auto" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center justify-between cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault()
                  onSortChange(column.key, 'desc')
                }}
              >
                <span className="font-medium">{directions.desc}</span>
                {isActive && activeDir === 'desc' && (
                  <Check className="size-3.5 text-primary ml-auto" />
                )}
              </DropdownMenuItem>
              {isActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault()
                      onSortChange(null, 'asc')
                    }}
                  >
                    <RotateCcw className="size-3 text-muted-foreground" />
                    <span>Reset to default order</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {column.hint && (
        <span className="block text-[10px] font-medium normal-case tracking-normal text-primary/80 mt-0.5">
          {column.hint}
        </span>
      )}
    </th>
  )
}
