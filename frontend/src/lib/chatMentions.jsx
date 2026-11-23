import { AtSign, Users } from 'lucide-react'

const GROUP_TOKENS = ['all', 'everyone', 'team']
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// People who actually belong to the tender team (the API also returns every other active user so they can be @mentioned directly).
export const teamMemberCount = (members) =>
  members.filter((m) => m.id !== 'all' && (m.is_owner || m.is_member)).length

// Highlights only real mentions (@all/@everyone/@team or a known username / full name) as whole
// tokens, so "@all please confirm" no longer swallows the rest of the sentence. Mirrors the
// backend's matching in chat/service hasMention.
export function renderMentions(content, members = []) {
  if (!content) return null
  const names = [
    ...GROUP_TOKENS,
    ...members.filter((m) => m.id !== 'all').flatMap((m) => [m.username, m.full_name]),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\w@])(@(?:${names.map(escapeRe).join('|')}))(?!\\w)`, 'gi')

  // split() with one capture group puts the matched mentions at the odd indexes.
  return content.split(re).map((part, idx) => {
    if (idx % 2 === 0) return <span key={idx}>{part}</span>
    const isGroup = GROUP_TOKENS.includes(part.slice(1).toLowerCase())
    return (
      <span
        key={idx}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[11px] mx-0.5 border ${
          isGroup
            ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
            : 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700'
        }`}
      >
        {isGroup ? <Users className="size-3 text-amber-600 shrink-0" /> : <AtSign className="size-3 text-indigo-600 shrink-0" />}
        <span>{part}</span>
      </span>
    )
  })
}
