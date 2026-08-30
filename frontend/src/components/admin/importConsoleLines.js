// Line builders for the bulk-import console. Kept out of the component file so
// Fast Refresh still works there, and so the wording lives in one place.

/** Builds the console lines for a parsed preview (nothing written yet). */
export function previewLines(fileName, data) {
  const out = [
    { tone: 'dim', text: `$ onetrack import --file "${fileName}" --dry-run` },
    { tone: 'ok', text: `workbook read — ${data.row_count} rows` },
  ]

  const skipped = data.skipped || []
  if (skipped.length) {
    out.push({ tone: 'head', text: `duplicate check — ${skipped.length} row(s) will be skipped` })
    skipped.forEach((s) =>
      out.push({ tone: 'skip', text: `row ${s.row}  ${s.bid_id || '(no tender id)'} — ${s.reason}` })
    )
  } else {
    out.push({ tone: 'ok', text: 'duplicate check — no existing tenders matched' })
  }

  const stages = Object.entries(data.stage_counts || {}).sort((a, b) => b[1] - a[1])
  if (stages.length) {
    out.push({ tone: 'head', text: 'derived lifecycle stage' })
    stages.forEach(([stage, n]) =>
      out.push({ tone: 'info', text: `${String(n).padStart(4)}  ${stage}` })
    )
  }

  const warned = (data.rows || []).filter((r) => r.warnings?.length)
  if (warned.length) {
    out.push({ tone: 'head', text: `rows repaired or interpreted — ${warned.length}` })
    warned.forEach((r) => out.push({ tone: 'warn', text: `row ${r.row}  ${r.warnings.join('; ')}` }))
  }

  out.push({ tone: 'dim', text: '— dry run, nothing written —' })
  out.push({ tone: 'head', text: `ready to import ${data.import_count} tender(s)` })
  return out
}

/** Builds the console lines for a completed import. */
export function commitLines(fileName, data) {
  const created = data.created_ids?.length ?? 0
  const skipped = data.skipped || []
  const out = [
    { tone: 'dim', text: `$ onetrack import --file "${fileName}" --commit` },
    { tone: 'info', text: 'opening transaction…' },
  ]

  ;(data.rows || [])
    .filter((r) => !r.skipped)
    .forEach((r) =>
      out.push({
        tone: 'ok',
        text: `row ${String(r.row).padStart(3)}  ${r.workflow_stage.padEnd(30)} ${r.title.slice(0, 44)}`,
      })
    )

  skipped.forEach((s) =>
    out.push({ tone: 'skip', text: `row ${String(s.row).padStart(3)}  SKIPPED — ${s.reason}` })
  )

  out.push({ tone: 'info', text: 'committing…' })
  out.push({ tone: 'ok', text: `committed — ${created} tender(s) created` })
  if (skipped.length) out.push({ tone: 'skip', text: `${skipped.length} row(s) skipped as already present` })
  out.push({ tone: 'head', text: 'import complete' })
  return out
}

/**
 * Builds the console lines for a failed import.
 *
 * `certain` is false only when the failure happened after a commit request
 * was already sent and the server's reply could not be read (e.g. the
 * connection dropped) - in that case the server may well have written the
 * data, so the console must not claim a rollback that may not have happened.
 * It is true for a dry run (which never writes) and for any error the server
 * itself reported, since the backend always rolls back before responding
 * with an error status.
 */
export function errorLines(fileName, message, certain = true) {
  return [
    { tone: 'dim', text: `$ onetrack import --file "${fileName}"` },
    { tone: 'error', text: message },
    certain
      ? { tone: 'dim', text: 'transaction rolled back — nothing was written' }
      : { tone: 'warn', text: 'response could not be confirmed — check the tender list before retrying, to avoid a duplicate import' },
  ]
}
