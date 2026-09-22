import type { ResourceBundle } from './resources'

// The kingdom's fixed build order -- each structure unlocks once its
// resource cost is affordable, always in this sequence (a farm needs a
// house standing first, etc.) so the scene reads as a real settlement
// growing outward, not a random unlock order. `pavilion` is the
// "temple-inspired decorative structure" the spec calls for, named and
// framed as purely decorative/cultural architecture (an ornamental
// kolam-arched pavilion) -- no religious mechanic attaches to it: it
// grants no special power, just visual richness, exactly like every
// other building.
export type BuildingId = 'house' | 'garden' | 'farm' | 'tower' | 'pavilion' | 'castle'

export interface BuildingDefinition {
  id: BuildingId
  name: string
  emoji: string
  cost: Partial<ResourceBundle>
  description: string
}

export const BUILD_ORDER: BuildingDefinition[] = [
  { id: 'house', name: 'House', emoji: '\u{1F3E0}', cost: { wood: 6 }, description: 'A first roof for your kingdom.' },
  { id: 'garden', name: 'Garden', emoji: '\u{1F333}', cost: { coins: 8 }, description: 'Trees and flowerbeds line the paths.' },
  { id: 'farm', name: 'Farm', emoji: '\u{1F33E}', cost: { wood: 8, stone: 4 }, description: 'Fields to feed the growing kingdom.' },
  { id: 'tower', name: 'Watchtower', emoji: '\u{1F5FC}', cost: { stone: 10 }, description: 'A tall stone tower watches over the land.' },
  { id: 'pavilion', name: 'Ornamental Pavilion', emoji: '\u{26E9}\u{FE0F}', cost: { stone: 10, coins: 10 }, description: 'A carved, kolam-arched pavilion -- purely decorative, built to look beautiful.' },
  { id: 'castle', name: 'Castle', emoji: '\u{1F3F0}', cost: { stone: 16, wood: 10, coins: 10, stars: 3 }, description: 'The crown jewel of your kingdom.' },
]

export function getBuilding(id: BuildingId): BuildingDefinition {
  const b = BUILD_ORDER.find((x) => x.id === id)
  if (!b) throw new Error(`Unknown Kingdom Builder building: ${id}`)
  return b
}

// The next building in the fixed sequence that hasn't been built yet
// -- null once every building stands, which is the kingdom's
// completion condition.
export function nextBuildingToConstruct(builtIds: BuildingId[]): BuildingDefinition | null {
  return BUILD_ORDER.find((b) => !builtIds.includes(b.id)) ?? null
}

export function isKingdomComplete(builtIds: BuildingId[]): boolean {
  return BUILD_ORDER.every((b) => builtIds.includes(b.id))
}
