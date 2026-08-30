import React, { useEffect, useRef, useState } from 'react'

/**
 * Terminal-style log for the bulk import.
 *
 * The parent remounts this with a fresh `key` for each run, so the reveal
 * position resets on its own without an effect fighting the render.
 *
 * Lines are fed in as the import progresses and typed out one at a time so the
 * operator can actually read what happened to each row, rather than watching a
 * spinner and then being handed a wall of text. The pending lines while the
 * request is in flight describe real phases; every per-row line comes from the
 * server's actual response, so nothing here is invented.
 */

const TONE = {
  info: 'text-slate-300',
  dim: 'text-slate-500',
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  skip: 'text-sky-400',
  error: 'text-rose-400',
  head: 'text-slate-100 font-semibold',
}

const PREFIX = {
  info: '·',
  dim: ' ',
  ok: '✓',
  warn: '!',
  skip: '»',
  error: '✗',
  head: '',
}

export function ImportConsole({ lines, running, doneLabel }) {
  const [shown, setShown] = useState(0)
  const endRef = useRef(null)

  // Reveal lines one by one. Fast enough to feel live, slow enough to read.
  useEffect(() => {
    if (shown >= lines.length) return
    const t = setTimeout(() => setShown((n) => n + 1), shown < 6 ? 90 : 28)
    return () => clearTimeout(t)
  }, [shown, lines.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [shown])

  const visible = lines.slice(0, shown)
  const stillRevealing = shown < lines.length

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden shadow-inner">
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <span className="size-2.5 rounded-full bg-rose-500/80" />
        <span className="size-2.5 rounded-full bg-amber-500/80" />
        <span className="size-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-2 font-mono text-[11px] text-slate-400">
          onetrack — bulk import
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto px-3 py-2.5 font-mono text-[11.5px] leading-relaxed">
        {visible.map((l, i) => (
          <div key={i} className={`flex gap-2 ${TONE[l.tone] || TONE.info}`}>
            <span className="select-none opacity-60 w-3 shrink-0">{PREFIX[l.tone] ?? '·'}</span>
            <span className="whitespace-pre-wrap break-words">{l.text}</span>
          </div>
        ))}

        {(running || stillRevealing) && (
          <div className="flex gap-2 text-slate-300">
            <span className="w-3 shrink-0 select-none opacity-60">·</span>
            <span className="inline-block h-3.5 w-2 animate-pulse bg-emerald-400 align-middle" />
          </div>
        )}

        {!running && !stillRevealing && doneLabel && (
          <div className="mt-1.5 flex gap-2 text-slate-500">
            <span className="w-3 shrink-0 select-none">$</span>
            <span>{doneLabel}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
