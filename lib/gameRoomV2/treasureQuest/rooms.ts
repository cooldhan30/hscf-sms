// Treasure Quest's room graph -- pure data, no rendering. A fixed
// layout (not per-session generated) keeps every playthrough legible
// and testable: the same rooms, doors, and treasure location every
// time, with only the QUESTIONS answered along the way varying (pulled
// entirely from the session's Question Set -- Treasure Quest itself
// never embeds lesson content).
export type RoomId = 'entrance' | 'library' | 'garden' | 'observatory' | 'cellar' | 'treasury'

export interface DoorDefinition {
  toRoomId: RoomId
  // A door needs this many keys held to pass through -- keys are
  // fungible (not room-specific), so a student can save up keys from
  // easy rooms to afford a pricier door later.
  keysRequired: number
}

export interface RoomDefinition {
  id: RoomId
  name: string
  tamilName: string
  description: string
  emoji: string
  // A room may hold ONE clue, discovered the first time the room is
  // entered -- clues are flavor/narrative collectibles, not required
  // for progress (a student who misses one can still reach the
  // treasury via keys alone).
  clue: string | null
  doors: DoorDefinition[]
}

export const ROOMS: RoomDefinition[] = [
  {
    id: 'entrance',
    name: 'The Entrance Hall',
    tamilName: 'நுழைவு மண்டபம்',
    description: 'Dusty light falls through a cracked skylight. Two doors lead deeper in.',
    emoji: '\u{1F3DB}️',
    clue: null,
    doors: [
      { toRoomId: 'library', keysRequired: 1 },
      { toRoomId: 'garden', keysRequired: 1 },
    ],
  },
  {
    id: 'library',
    name: 'The Old Library',
    tamilName: 'பழைய நூலகம்',
    description: 'Towering shelves of forgotten palm-leaf manuscripts.',
    emoji: '\u{1F4DA}',
    clue: 'A margin note reads: "The stars remember what the stones forget."',
    doors: [{ toRoomId: 'observatory', keysRequired: 2 }],
  },
  {
    id: 'garden',
    name: 'The Sunken Garden',
    tamilName: 'அமிழ்ந்த தோட்டம்',
    description: 'Overgrown vines curl around a dry fountain.',
    emoji: '\u{1F33F}',
    clue: 'Carved into the fountain: "Below the roots, the earth keeps secrets."',
    doors: [{ toRoomId: 'cellar', keysRequired: 2 }],
  },
  {
    id: 'observatory',
    name: 'The Observatory',
    tamilName: 'வானாய்வு கூடம்',
    description: 'A great brass telescope points at a painted ceiling of stars.',
    emoji: '\u{1F52D}',
    clue: null,
    doors: [{ toRoomId: 'treasury', keysRequired: 3 }],
  },
  {
    id: 'cellar',
    name: 'The Stone Cellar',
    tamilName: 'கல் அடித்தளம்',
    description: 'Cool air and the smell of old earth.',
    emoji: '\u{1FAA8}',
    clue: null,
    doors: [{ toRoomId: 'treasury', keysRequired: 3 }],
  },
  {
    id: 'treasury',
    name: 'The Treasury',
    tamilName: 'கருவூலம்',
    description: 'At last -- the treasure chest, waiting.',
    emoji: '\u{1F4B0}',
    clue: null,
    doors: [],
  },
]

export const START_ROOM_ID: RoomId = 'entrance'
export const TREASURE_ROOM_ID: RoomId = 'treasury'

export function getRoom(id: RoomId): RoomDefinition {
  const r = ROOMS.find((room) => room.id === id)
  if (!r) throw new Error(`Unknown room: ${id}`)
  return r
}

// Every reachable room walking from the entrance -- used to assert the
// graph is fully connected (no room a player could get stuck unable to
// reach) and, more importantly, that the treasury is actually reachable
// at all from the entrance.
export function reachableRoomIds(fromRoomId: RoomId = START_ROOM_ID): Set<RoomId> {
  const visited = new Set<RoomId>()
  const queue: RoomId[] = [fromRoomId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const door of getRoom(current).doors) {
      if (!visited.has(door.toRoomId)) queue.push(door.toRoomId)
    }
  }
  return visited
}
