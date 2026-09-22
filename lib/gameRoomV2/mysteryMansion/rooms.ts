// The mansion's fixed room sequence -- entrance first, garden last,
// matching the spec's suggested visual areas. A friendly, adventurous
// mystery (a missing heirloom, never anything frightening) unfolds
// room by room; each room's clue text is filled in per-session by
// generator.ts, not hardcoded here -- this file only defines the
// STRUCTURE (which rooms exist, in what order, what each looks like
// visually), never the mystery's actual content.
export type RoomId = 'entrance' | 'library' | 'study' | 'gallery' | 'attic' | 'garden'

export interface RoomDefinition {
  id: RoomId
  name: string
  emoji: string
  // A short, atmospheric-but-friendly flavor line shown on entry --
  // curiosity and adventure, never dread or fear, per the "NOT horror"
  // requirement.
  ambiance: string
}

export const MANSION_ROOMS: RoomDefinition[] = [
  { id: 'entrance', name: 'Entrance Hall', emoji: '\u{1F3E1}', ambiance: 'Sunlight streams through tall windows onto a dusty welcome mat.' },
  { id: 'library', name: 'Library', emoji: '\u{1F4DA}', ambiance: 'Towering shelves of books, one drawer left slightly open.' },
  { id: 'study', name: 'Study', emoji: '\u{1F4DD}', ambiance: 'A writing desk covered in old letters and a half-finished puzzle.' },
  { id: 'gallery', name: 'Gallery', emoji: '\u{1F5BC}\u{FE0F}', ambiance: 'Portraits line the walls -- one frame looks strangely empty.' },
  { id: 'attic', name: 'Attic', emoji: '\u{1F4E6}', ambiance: 'Trunks and cobwebbed boxes, and a curious glint in the corner.' },
  { id: 'garden', name: 'Garden', emoji: '\u{1F33B}', ambiance: 'A quiet courtyard garden where the final piece awaits.' },
]

export function getRoom(id: RoomId): RoomDefinition {
  const room = MANSION_ROOMS.find((r) => r.id === id)
  if (!room) throw new Error(`Unknown Mystery Mansion room: ${id}`)
  return room
}

export const ROOM_COUNT = MANSION_ROOMS.length
