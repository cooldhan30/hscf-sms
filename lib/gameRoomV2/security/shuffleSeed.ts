import { createHash } from 'crypto'

// Server-only salt for the per-session option/pair/letter shuffles in
// /state. The shuffle is deterministic (so an order stays stable across
// polls), which means its seed must NOT be derivable by the client:
// seeded from sessionId + questionId alone, a client could replay the
// permutation and invert it -- recovering MATCH pairs (left and right
// are shuffled independently) or the correct ORDER_WORDS/ORDER_LETTERS
// order from the stripped payload. Derived from a server-only secret so
// no new environment variable is required.
let cached: string | null = null

export function shuffleSalt(): string {
  if (cached) return cached
  const secret = process.env.GAMEROOM_V2_SHUFFLE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Missing GAMEROOM_V2_SHUFFLE_SECRET / SUPABASE_SERVICE_ROLE_KEY for the shuffle salt')
  cached = createHash('sha256').update(`gamev2-shuffle:${secret}`).digest('hex').slice(0, 32)
  return cached
}
