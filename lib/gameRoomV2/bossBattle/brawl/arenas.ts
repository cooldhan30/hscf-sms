// Boss Battle arenas -- the LOGICAL layout of each environment (bounds,
// solid obstacles, spawn gates, hazard zones). Pure data: the renderer
// (components/gameRoomV2/bossBattle/brawl/scenery.ts) paints each arena's
// own scenery around these, so the gameplay geometry and the artwork can
// never disagree.
//
// World units: every arena is WORLD_W x WORLD_H. The playable rectangle
// (`bounds`) sits inside it; the band around it is scenery only.

export const WORLD_W = 1600
export const WORLD_H = 1000

export type ArenaId = 'temple' | 'forest' | 'river' | 'volcano'

export interface Obstacle {
  x: number
  y: number
  r: number
  kind: 'pillar' | 'rock' | 'tree' | 'ruin' | 'wall' | 'obsidian' | 'lamp'
}

export interface Hazard {
  x: number
  y: number
  r: number
  // Damage per second while standing inside (the player only).
  dps: number
}

export interface Arena {
  id: ArenaId
  name: string
  tamilName: string
  blurb: string
  bounds: { x0: number; y0: number; x1: number; y1: number }
  obstacles: Obstacle[]
  // Where enemies enter (inside the bounds, at a gate/bridge/forest edge).
  spawns: { x: number; y: number }[]
  // Always-on environmental hazards (Volcanic Citadel's lava vents).
  hazards: Hazard[]
  playerStart: { x: number; y: number }
  bossStart: { x: number; y: number }
}

export const ARENAS: Arena[] = [
  {
    id: 'temple',
    name: 'Temple Courtyard',
    tamilName: 'கோயில் முற்றம்',
    blurb: 'Stone pillars and lamp-lit steps. The pillars block the way -- use them.',
    bounds: { x0: 90, y0: 90, x1: 1510, y1: 920 },
    obstacles: [
      { x: 430, y: 300, r: 34, kind: 'pillar' },
      { x: 430, y: 700, r: 34, kind: 'pillar' },
      { x: 1170, y: 300, r: 34, kind: 'pillar' },
      { x: 1170, y: 700, r: 34, kind: 'pillar' },
      { x: 800, y: 240, r: 30, kind: 'lamp' },
      { x: 800, y: 760, r: 30, kind: 'lamp' },
    ],
    spawns: [
      { x: 120, y: 505 },
      { x: 1480, y: 505 },
      { x: 800, y: 120 },
      { x: 800, y: 890 },
      { x: 150, y: 150 },
      { x: 1450, y: 860 },
    ],
    hazards: [],
    playerStart: { x: 800, y: 505 },
    bossStart: { x: 800, y: 200 },
  },
  {
    id: 'forest',
    name: 'Forest Ruins',
    tamilName: 'காட்டு இடிபாடுகள்',
    blurb: 'Ancient walls swallowed by roots. Enemies slip out of the trees.',
    bounds: { x0: 110, y0: 100, x1: 1490, y1: 910 },
    obstacles: [
      { x: 360, y: 260, r: 46, kind: 'tree' },
      { x: 1250, y: 760, r: 46, kind: 'tree' },
      { x: 1230, y: 250, r: 40, kind: 'tree' },
      { x: 560, y: 690, r: 28, kind: 'ruin' },
      { x: 612, y: 690, r: 28, kind: 'ruin' },
      { x: 664, y: 700, r: 26, kind: 'ruin' },
      { x: 960, y: 330, r: 28, kind: 'ruin' },
      { x: 1010, y: 318, r: 26, kind: 'ruin' },
      { x: 300, y: 800, r: 30, kind: 'rock' },
    ],
    spawns: [
      { x: 140, y: 400 },
      { x: 140, y: 700 },
      { x: 1460, y: 450 },
      { x: 700, y: 130 },
      { x: 1100, y: 880 },
      { x: 450, y: 880 },
    ],
    hazards: [],
    playerStart: { x: 800, y: 540 },
    bossStart: { x: 800, y: 220 },
  },
  {
    id: 'river',
    name: 'River Fort',
    tamilName: 'ஆற்றுக் கோட்டை',
    blurb: 'The river guards the north. Raiders pour over the two bridges.',
    bounds: { x0: 90, y0: 270, x1: 1510, y1: 920 },
    obstacles: [
      { x: 250, y: 860, r: 40, kind: 'wall' },
      { x: 320, y: 860, r: 40, kind: 'wall' },
      { x: 1280, y: 860, r: 40, kind: 'wall' },
      { x: 1350, y: 860, r: 40, kind: 'wall' },
      { x: 800, y: 560, r: 36, kind: 'rock' },
      { x: 560, y: 420, r: 24, kind: 'rock' },
      { x: 1080, y: 690, r: 26, kind: 'rock' },
    ],
    spawns: [
      { x: 450, y: 290 },
      { x: 1150, y: 290 },
      { x: 120, y: 600 },
      { x: 1480, y: 600 },
    ],
    hazards: [],
    playerStart: { x: 800, y: 760 },
    bossStart: { x: 800, y: 360 },
  },
  {
    id: 'volcano',
    name: 'Volcanic Citadel',
    tamilName: 'எரிமலைக் கோட்டை',
    blurb: 'Black rock and glowing vents. Stay off the lava.',
    bounds: { x0: 100, y0: 100, x1: 1500, y1: 910 },
    obstacles: [
      { x: 420, y: 330, r: 40, kind: 'obsidian' },
      { x: 1190, y: 650, r: 40, kind: 'obsidian' },
      { x: 1180, y: 300, r: 30, kind: 'obsidian' },
      { x: 430, y: 690, r: 30, kind: 'obsidian' },
    ],
    spawns: [
      { x: 130, y: 505 },
      { x: 1470, y: 505 },
      { x: 800, y: 130 },
      { x: 800, y: 880 },
    ],
    hazards: [
      { x: 640, y: 505, r: 54, dps: 10 },
      { x: 960, y: 505, r: 54, dps: 10 },
    ],
    playerStart: { x: 800, y: 650 },
    bossStart: { x: 800, y: 220 },
  },
]

export function getArena(id: ArenaId): Arena {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0]
}
