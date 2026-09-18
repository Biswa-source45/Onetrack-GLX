import * as React from "react"
import { createPortal } from "react-dom"
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
//
// presetOptions (optional) turns this into a typable dropdown: a fixed list
// of expected choices (e.g. "GeM", "CPPP", "eProcure") shown in full on
// focus — before anything is typed — deduped against and extended by
// whatever's been typed as a custom value before. There's no separate
// "Other" mode: picking a preset sets that value, typing anything else just
// becomes the (remembered, next time suggested) custom value. Fields
// without presetOptions keep the original memory-only behavior exactly —
// no dropdown until the user starts typing.
const FieldMemoryInput = React.forwardRef(function FieldMemoryInput(
  { fieldKey, value, onChange, onBlur, onKeyDown, className, maxSuggestions = 6, presetOptions, ...props },
  forwardedRef
) {
  const suggestions = useBidStore((s) => s.fieldSuggestions[fieldKey])
  const loadFieldSuggestions = useBidStore((s) => s.loadFieldSuggestions)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  // A preset field usually opens with a value already in it (e.g. Portal
  // Source defaults to "GeM") — without this, opening the dropdown would
  // filter down to just that value instead of showing every choice. Cleared
  // the moment the user actually types, so filtering behaves normally from
  // then on.
  const [justFocused, setJustFocused] = React.useState(false)
  const listId = React.useId()
  const inputRef = React.useRef(null)
  const setRefs = React.useCallback((node) => {
    inputRef.current = node
    if (typeof forwardedRef === "function") forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  React.useEffect(() => {
    if (fieldKey) loadFieldSuggestions(fieldKey)
  }, [fieldKey, loadFieldSuggestions])

  // The list is portaled straight to <body> and positioned from the input's
  // own bounding box (see below) instead of being absolutely positioned
  // inside this component's own DOM tree — every table on this app wraps in
  // an overflow-x-auto container, and per the CSS spec that silently forces
  // overflow-y to "auto" too, clipping any dropdown anchored near the
  // bottom or right edge of the table. Recomputed on open and on every
  // scroll/resize while open so it tracks the input if the page moves.
  const [coords, setCoords] = React.useState(null)
  const updateCoords = React.useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  const query = justFocused ? "" : (value || "").trim().toLowerCase()
  const filtered = React.useMemo(() => {
    if (presetOptions) {
      const pool = []
      const seen = new Set()
      for (const p of presetOptions) {
        const k = p.toLowerCase()
        if (!seen.has(k)) { seen.add(k); pool.push({ value: p }) }
      }
      for (const s of suggestions || []) {
        const k = s.value.toLowerCase()
        if (!seen.has(k)) { seen.add(k); pool.push(s) }
      }
      if (!query) return pool.slice(0, maxSuggestions)
      return pool.filter((s) => s.value.toLowerCase().includes(query)).slice(0, maxSuggestions)
    }
    if (!query || !suggestions || suggestions.length === 0) return []
    return suggestions
      .filter((s) => s.value.toLowerCase().startsWith(query))
      .slice(0, maxSuggestions)
  }, [suggestions, presetOptions, query, maxSuggestions])

  const showList = open && filtered.length > 0

  React.useLayoutEffect(() => {
    if (!showList) return
    updateCoords()
    window.addEventListener("scroll", updateCoords, true)
    window.addEventListener("resize", updateCoords)
    return () => {
      window.removeEventListener("scroll", updateCoords, true)
      window.removeEventListener("resize", updateCoords)
    }
  }, [showList, updateCoords])

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
        ref={setRefs}
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
          setJustFocused(false)
          setActiveIndex(-1)
        }}
        onFocus={(e) => {
          setOpen(true)
          if (presetOptions) {
            setJustFocused(true)
            e.target.select()
          }
        }}
        onBlur={(e) => {
          setOpen(false)
          setJustFocused(false)
          onBlur?.(e)
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {showList && coords && createPortal(
        <ul
          id={listId}
          role="listbox"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md py-1"
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
        </ul>,
        document.body
      )}
    </div>
  )
})
FieldMemoryInput.displayName = "FieldMemoryInput"

export { FieldMemoryInput }
