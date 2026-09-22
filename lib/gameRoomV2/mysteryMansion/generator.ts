import { MANSION_ROOMS, type RoomId } from './rooms'
import { MYSTERY_TEMPLATES, type MysteryTemplate } from './templates'

// A tiny deterministic string hash + PRNG (mulberry32) -- no external
// dependency, no Math.random(). Seeding from the session's own id
// means the SAME session always regenerates the SAME mystery (so a
// page refresh mid-game doesn't hand the student a different mystery
// underfoot), while a NEW session (a fresh sessionId, which the
// server mints per play -- see sessions/start/route.ts) gets a
// genuinely different template/suspect/clue-order combination. This is
// exactly what "generated from the selected question set and should
// remain replayable" means in practice: replaying (starting a new
// session against the same Question Set) produces a different mystery
// each time, without any of it needing to be stored server-side --
// the question set's own id/content never encodes the mystery, only
// the ephemeral session id does.
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]
}

export interface GeneratedMystery {
  template: MysteryTemplate
  suspect: string
  foundLocationRoomId: RoomId
  // One short clue line per room, in MANSION_ROOMS order -- shown when
  // that room's question is answered correctly. The LAST room's clue
  // is deliberately the resolution-bearing one (see
  // buildResolutionText), so the final room is always where the
  // mystery visibly comes together.
  clueByRoomId: Record<RoomId, string>
}

const CLUE_PHRASINGS = [
  (item: string) => `A faint trace of ${item} was seen here recently.`,
  (item: string) => `Someone was definitely looking for ${item} in this room.`,
  (item: string) => `This room holds a hint about where ${item} might be.`,
  (item: string) => `A small clue about ${item} rests here, easy to miss.`,
]

// Deterministically builds one full mystery from a seed string (always
// the session id in practice). Picks a template, a suspect from that
// template's list, a found-location room (never the entrance, since
// that's where the mystery BEGINS, not where it resolves), and one
// flavor clue per room.
export function generateMystery(seed: string): GeneratedMystery {
  const rand = mulberry32(hashSeed(seed))
  const template = pick(MYSTERY_TEMPLATES, rand)
  const suspect = pick(template.suspects, rand)
  const candidateRooms = MANSION_ROOMS.filter((r) => r.id !== 'entrance')
  const foundLocationRoomId = pick(candidateRooms, rand).id

  const clueByRoomId = {} as Record<RoomId, string>
  for (const room of MANSION_ROOMS) {
    const phrasing = pick(CLUE_PHRASINGS, rand)
    clueByRoomId[room.id] = phrasing(template.missingItem)
  }

  return { template, suspect, foundLocationRoomId, clueByRoomId }
}

export function buildResolutionText(mystery: GeneratedMystery): string {
  const foundRoom = MANSION_ROOMS.find((r) => r.id === mystery.foundLocationRoomId)!
  return mystery.template.resolutionText(mystery.suspect, foundRoom.name)
}
