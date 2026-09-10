import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBidStore } from "@/store/useBidStore"

// FieldMemoryInput — a plain text Input that remembers every value it's ever
// been given (see useBidStore.loadFieldSuggestions) and suggests a match as
// you type. Non-AI: exact-prefix filtering over a list the backend already
// ranked by usage. Drop-in replacement for <Input>: same value/onChange
// contract, just with a fieldKey naming which suggestion list to use.
//
// Keyboard: suggestions appear as you type (never requires Enter first);
// ArrowUp/ArrowDown move the highlight, Tab or Enter accepts it, Escape
// dismisses. A no-op keystroke commits nothing, so plain typing is untouched.
const FieldMemoryInput = React.forwardRef(function FieldMemoryInput(
  { fieldKey, value, onChange, onBlur, onKeyDown, className, maxSuggestions = 6, ...props },
  forwardedRef
) {
  const suggestions = useBidStore((s) => s.fieldSuggestions[fieldKey])
  const loadFieldSuggestions = useBidStore((s) => s.loadFieldSuggestions)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const listId = React.useId()

  React.useEffect(() => {
    if (fieldKey) loadFieldSuggestions(fieldKey)
  }, [fieldKey, loadFieldSuggestions])

  const query = (value || "").trim().toLowerCase()
  const filtered = React.useMemo(() => {
    if (!query || !suggestions || suggestions.length === 0) return []
    return suggestions
      .filter((s) => s.value.toLowerCase().startsWith(query))
      .slice(0, maxSuggestions)
  }, [suggestions, query, maxSuggestions])

  const showList = open && filtered.length > 0

  function commit(val) {
    onChange(val)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e) {
    if (showList) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Tab" || e.key === "Enter") {
        const idx = activeIndex === -1 ? 0 : activeIndex
        if (filtered[idx]) {
          e.preventDefault()
          commit(filtered[idx].value)
        }
      } else if (e.key === "Escape") {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={forwardedRef}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeIndex > -1 ? `${listId}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          setOpen(false)
          onBlur?.(e)
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md py-1"
        >
          {filtered.map((s, i) => (
            <li
              key={s.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // preventDefault keeps focus on the input, so selecting a
              // suggestion by mouse never fires the input's blur handler.
              onMouseDown={(e) => {
                e.preventDefault()
                commit(s.value)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "px-2.5 py-1.5 text-sm cursor-pointer truncate",
                i === activeIndex && "bg-accent text-accent-foreground"
              )}
            >
              {s.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
FieldMemoryInput.displayName = "FieldMemoryInput"

export { FieldMemoryInput }
