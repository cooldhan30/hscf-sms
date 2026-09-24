// Each background is paired with the text color that actually passes
// contrast against IT specifically -- mint-500/cyan-500/lime-600 all
// measure well under 3:1 (let alone the 4.5:1 real-text threshold) with
// white text on top; gamev2ink-950 passes all three at 6.3:1-8.8:1. The
// darker ink/coral/magenta backgrounds keep white, which already passes.
const AVATAR_COLORS = [
  { bg: 'bg-gamev2ink-500', text: 'text-white' },
  { bg: 'bg-gamev2coral-500', text: 'text-white' },
  { bg: 'bg-gamev2mint-500', text: 'text-gamev2ink-950' },
  { bg: 'bg-gamev2cyan-500', text: 'text-gamev2ink-950' },
  { bg: 'bg-gamev2magenta-500', text: 'text-white' },
  { bg: 'bg-gamev2lime-600', text: 'text-gamev2ink-950' },
]

// Deterministic color per name (same idea as most chat-app avatar
// colors) so a given player always gets the same color across a
// session without needing to persist a color choice anywhere. Hashing
// per UTF-16 code unit (not per grapheme) is fine here -- unlike the
// initial-letter extraction below, this never needs to isolate one
// meaningful character, only produce a stable number, and code-unit
// iteration is stable/deterministic regardless of script.
function colorForName(name: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// The first GRAPHEME of a name, not the first UTF-16 code unit.
// name.charAt(0) on a Tamil name starting with a consonant+vowel-sign
// combination (e.g. "கிருஷ்ணா") would silently drop the vowel sign and
// show the bare consonant "க" instead of "கி" -- a different, incorrect
// letter, not a crash or visibly broken glyph, which is exactly why it
// was easy to miss. Intl.Segmenter is a native browser/Node API (no new
// dependency) that understands grapheme cluster boundaries per Unicode
// UAX #29, which is the actual definition of "one visual character" for
// scripts like Tamil where a single glyph can span multiple code points.
// Exported so scripts/verify-gameroom-v2-tamil.ts can assert on it
// directly rather than only indirectly via the full component.
export function firstGrapheme(text: string): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = segmenter.segment(text)[Symbol.iterator]().next()
    if (!first.done) return first.value.segment
  }
  // Fallback for an environment without Intl.Segmenter (very old
  // browsers) -- still better than a raw index: Array.from on a string
  // iterates by Unicode CODE POINT (correctly keeps surrogate pairs
  // together), which is closer to correct than charAt(0) even though it
  // doesn't merge combining marks the way a true grapheme cluster does.
  return Array.from(text)[0] ?? ''
}

export function PlayerAvatar({
  name,
  size = 'md',
  rank,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  rank?: number
}) {
  const trimmedName = name.trim()
  const initial = trimmedName ? firstGrapheme(trimmedName).toUpperCase() : '?'
  const { bg, text } = colorForName(name)
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' }

  return (
    <div className="relative inline-flex">
      <div
        className={`rounded-2xl flex items-center justify-center font-extrabold font-tamil ${bg} ${text} ${sizeClasses[size]}`}
        aria-hidden
      >
        {initial}
      </div>
      {rank !== undefined && rank <= 3 && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gamev2spark-400 text-gamev2ink-950 text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-gamev2ink-950"
          aria-hidden
        >
          {rank}
        </span>
      )}
      <span className="sr-only">{name}{rank !== undefined ? `, rank ${rank}` : ''}</span>
    </div>
  )
}
