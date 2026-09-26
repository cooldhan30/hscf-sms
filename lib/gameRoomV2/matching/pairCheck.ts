// Shared by the pair-check route and its verifier: which engines may ask
// the server "is this a pair?", and the answer itself (same exact-string
// rule gradeAnswer's MATCH case uses for the full submission).
export const PAIR_CHECK_ENGINES = ['matching', 'memory']

export function isPairInMatchPayload(payload: unknown, left: string, right: string): boolean {
  const pairs = (payload as { pairs?: { left?: unknown; right?: unknown }[] } | null)?.pairs
  if (!Array.isArray(pairs)) return false
  return pairs.some((p) => p && p.left === left && p.right === right)
}
