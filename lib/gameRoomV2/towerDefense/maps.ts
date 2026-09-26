// Battlefield layouts. The field is a 12 x 7 grid of cells; coordinates
// are in cell units (a cell's centre is x + 0.5). Enemies walk the `path`
// polyline from the first point (the gate, off the left edge) to the last
// (the fort, off the right edge). Towers can only be built on `pads`.
export const GRID_COLS = 12
export const GRID_ROWS = 7

export interface Point {
  x: number
  y: number
}

export interface TdMap {
  id: string
  name: string
  tamilName: string
  path: Point[]
  pads: { id: string; x: number; y: number }[]
}

function pads(points: [number, number][]) {
  return points.map(([x, y], i) => ({ id: `pad-${i + 1}`, x, y }))
}

export const TD_MAPS: TdMap[] = [
  {
    id: 'river-bend',
    name: 'River Bend',
    tamilName: 'ஆற்றங்கரை',
    path: [
      { x: -0.5, y: 1.5 },
      { x: 3.5, y: 1.5 },
      { x: 3.5, y: 5.5 },
      { x: 7.5, y: 5.5 },
      { x: 7.5, y: 1.5 },
      { x: 10.5, y: 1.5 },
      { x: 10.5, y: 4.5 },
      { x: 12.5, y: 4.5 },
    ],
    pads: pads([
      [2.5, 2.5],
      [4.5, 0.5],
      [4.5, 3.5],
      [2.5, 4.5],
      [5.5, 4.5],
      [6.5, 3.5],
      [5.5, 6.5],
      [6.5, 0.5],
      [8.5, 3.5],
      [9.5, 2.5],
      [9.5, 5.5],
      [11.5, 3.5],
    ]),
  },
  {
    id: 'temple-steps',
    name: 'Temple Steps',
    tamilName: 'கோயில் படிகள்',
    path: [
      { x: -0.5, y: 5.5 },
      { x: 2.5, y: 5.5 },
      { x: 2.5, y: 1.5 },
      { x: 5.5, y: 1.5 },
      { x: 5.5, y: 5.5 },
      { x: 9.5, y: 5.5 },
      { x: 9.5, y: 1.5 },
      { x: 12.5, y: 1.5 },
    ],
    pads: pads([
      [1.5, 4.5],
      [1.5, 2.5],
      [3.5, 3.5],
      [3.5, 0.5],
      [4.5, 2.5],
      [6.5, 3.5],
      [4.5, 6.5],
      [7.5, 4.5],
      [8.5, 3.5],
      [7.5, 6.5],
      [10.5, 2.5],
      [11.5, 0.5],
    ]),
  },
  {
    id: 'village-road',
    name: 'Village Road',
    tamilName: 'கிராமச் சாலை',
    path: [
      { x: -0.5, y: 0.5 },
      { x: 5.5, y: 0.5 },
      { x: 5.5, y: 3.5 },
      { x: 1.5, y: 3.5 },
      { x: 1.5, y: 6.5 },
      { x: 8.5, y: 6.5 },
      { x: 8.5, y: 2.5 },
      { x: 12.5, y: 2.5 },
    ],
    pads: pads([
      [4.5, 1.5],
      [6.5, 0.5],
      [6.5, 2.5],
      [2.5, 2.5],
      [3.5, 4.5],
      [0.5, 5.5],
      [2.5, 5.5],
      [6.5, 5.5],
      [7.5, 4.5],
      [9.5, 3.5],
      [9.5, 1.5],
      [11.5, 3.5],
    ]),
  },
]

export function getMap(id: string): TdMap {
  return TD_MAPS.find((m) => m.id === id) ?? TD_MAPS[0]
}

// --- Path geometry --------------------------------------------------------

export function pathLength(path: Point[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return total
}

export function positionAt(path: Point[], distance: number): Point {
  if (distance <= 0) return { ...path[0] }
  let remaining = distance
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= len) {
      const t = len === 0 ? 0 : remaining / len
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= len
  }
  return { ...path[path.length - 1] }
}

// Cells the path passes through (for scenery placement and validation).
export function pathCells(path: Point[]): Set<string> {
  const cells = new Set<string>()
  const total = pathLength(path)
  for (let d = 0; d <= total; d += 0.25) {
    const p = positionAt(path, d)
    const cx = Math.floor(p.x)
    const cy = Math.floor(p.y)
    if (cx >= 0 && cx < GRID_COLS && cy >= 0 && cy < GRID_ROWS) cells.add(`${cx},${cy}`)
  }
  return cells
}
