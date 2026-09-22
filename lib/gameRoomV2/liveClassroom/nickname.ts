// Derives a live-lobby display nickname from a student's real profile
// name -- first name + last initial only (never the full last name),
// since a live lobby roster is visible to every OTHER STUDENT in the
// session, not just the teacher. This is deliberately MORE private than
// legacy GameRoom's own nickname derivation (full "first last"), per
// the "do not expose personal student information unnecessarily"
// requirement -- a shared classroom screen showing full last names is
// more exposure than a live game roster needs.
//
// Never student-supplied: a student cannot set their own nickname, so
// there is no free-text-nickname abuse surface (impersonation, slurs,
// etc.) to defend against in the first place.
export function deriveLiveNickname(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? '').trim()
  const lastInitial = (lastName ?? '').trim().charAt(0).toUpperCase()

  if (!first && !lastInitial) return 'Player'
  if (!lastInitial) return first
  return `${first} ${lastInitial}.`
}
