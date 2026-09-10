// WhatsApp-style date-separator labels for chronological lists: "Today",
// "Yesterday", the weekday name for the rest of the past week, then a full
// date. Used to group audit-trail-style feeds (newest first) into day bands.
export function dateGroupLabel(dateInput) {
  const d = new Date(dateInput)
  const startOfDay = (date) => { const x = new Date(date); x.setHours(0, 0, 0, 0); return x }
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' })
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}
