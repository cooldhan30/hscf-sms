// The fixed mission path -- a sequence of planets/checkpoints the ship
// travels between, in order. A straight line (unlike Treasure Quest's
// branching room graph) since Space Mission's core loop is "correct
// answers push you forward along one path," not "choose which door to
// open" -- the exploration/choice mechanic already belongs to Treasure
// Quest, so Space Mission deliberately does something different:
// steady forward progress with a resource (fuel/shields) to manage.
export interface PlanetDefinition {
  id: string
  name: string
  emoji: string
  // Distance from the start, in mission-progress units. The final
  // planet's distance is the mission's total length.
  distance: number
}

export const MISSION_ROUTE: PlanetDefinition[] = [
  { id: 'launch', name: 'Launch Pad', emoji: '\u{1F680}', distance: 0 },
  { id: 'luna', name: 'Luna Outpost', emoji: '\u{1F311}', distance: 20 },
  { id: 'mangala', name: 'Mangala Station', emoji: '\u{1FA90}', distance: 45 },
  { id: 'vyazham', name: 'Vyazham Relay', emoji: '\u{1FA90}', distance: 70 },
  { id: 'home', name: 'Home System', emoji: '\u{1F30C}', distance: 100 },
]

export const MISSION_LENGTH = MISSION_ROUTE[MISSION_ROUTE.length - 1].distance

export function getPlanet(id: string): PlanetDefinition {
  const planet = MISSION_ROUTE.find((p) => p.id === id)
  if (!planet) throw new Error(`Unknown Space Mission planet: ${id}`)
  return planet
}

// The next checkpoint the ship hasn't reached yet, given current
// distance travelled -- used to know which planet's arrival banner to
// show next.
export function nextUnreachedPlanet(distanceTravelled: number): PlanetDefinition | null {
  return MISSION_ROUTE.find((p) => p.distance > distanceTravelled) ?? null
}

// Every checkpoint id at or below the given distance -- the ship's
// full arrival history, in route order.
export function reachedPlanetIds(distanceTravelled: number): string[] {
  return MISSION_ROUTE.filter((p) => p.distance <= distanceTravelled).map((p) => p.id)
}
