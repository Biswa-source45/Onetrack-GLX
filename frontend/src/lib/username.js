// Username for a new user: the part of the email before the "@" (jane.smith@globx.co.in -> jane.smith).
// Login accepts either the username or the email, so the two always point at the same person.

/** "Jane.Smith@globx.co.in" -> "jane.smith"; no "@" yet (still typing) -> what has been typed, lower-cased. */
export function usernameFromEmail(email) {
  return String(email ?? '').split('@')[0].trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Next username while the email box changes. The username follows the email until someone types their own:
 * it is replaced only when empty or still equal to what the previous email would have produced.
 */
export function nextUsername(currentUsername, previousEmail, nextEmail) {
  const untouched = !currentUsername || currentUsername === usernameFromEmail(previousEmail)
  return untouched ? usernameFromEmail(nextEmail) : currentUsername
}
