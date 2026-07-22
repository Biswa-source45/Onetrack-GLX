import React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * Derives 1-2 initials from a display name or username.
 * Examples:
 *   "John Doe"  → "JD"
 *   "john.doe"  → "J"
 *   ""          → "?"
 */
function getInitials(fullName, username) {
  const source = fullName?.trim() || username?.trim() || ''
  if (!source) return '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source[0].toUpperCase()
}

/**
 * Deterministic hue derived from username so the same user always
 * gets the same background colour across sessions.
 */
function getHue(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash) % 360
}

/**
 * UserAvatar renders an Avatar with auto-generated initials and a
 * deterministic background colour, matching the system design tokens.
 *
 * @param {{ fullName?: string, username?: string, size?: 'sm'|'default'|'lg', className?: string }} props
 */
export function UserAvatar({ fullName, username, size = 'default', className }) {
  const initials = getInitials(fullName, username)
  const hue = getHue(username || fullName || '')

  // Restrict to desaturated tones that look professional on white backgrounds.
  const bg = `hsl(${hue}, 25%, 88%)`
  const color = `hsl(${hue}, 30%, 28%)`

  return (
    <Avatar size={size} className={className}>
      <AvatarFallback style={{ backgroundColor: bg, color }} className="text-xs font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
