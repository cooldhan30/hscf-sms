import { GRID_COLS, GRID_ROWS } from '@/lib/gameRoomV2/towerDefense'

// World -> screen mapping for the full-viewport battlefield. The
// simulation lives on a 12 x 7 grid (cell units). The playfield is scaled
// to the largest cell size that fits the viewport (leaving room for the
// floating HUD at the top and the control tray at the bottom) and
// centred; the terrain is painted across the WHOLE viewport around it,
// so there is never dead space at any aspect ratio. On a portrait screen
// the field is transposed (gate at the top, fort at the bottom).

export interface TdLayout {
  width: number
  height: number
  portrait: boolean
  cell: number
  // Screen position of world (0,0).
  ox: number
  oy: number
  fieldW: number
  fieldH: number
}

export const HUD_TOP = 64
export const TRAY_BOTTOM = 92

export function computeLayout(width: number, height: number): TdLayout {
  const portrait = height > width * 1.05
  const cols = portrait ? GRID_ROWS : GRID_COLS
  const rows = portrait ? GRID_COLS : GRID_ROWS
  const top = HUD_TOP
  const bottom = TRAY_BOTTOM
  // The gate and the fort sit just beyond the two ends of the road, so
  // the fit reserves room for each along the road's axis -- ~1.6 cells a
  // side in landscape, so the fort (and a strip of world beyond it) is
  // never clipped by the screen edge and the road doesn't run edge to
  // edge; a wider screen shows more scenery rather than a wider board.
  const extraX = portrait ? 0.4 : 3.2
  const extraY = portrait ? 2.2 : 0.2
  const cell = Math.max(24, Math.min((width - 16) / (cols + extraX), (height - top - bottom) / (rows + extraY)))
  const fieldW = cols * cell
  const fieldH = rows * cell
  const ox = (width - fieldW) / 2
  const oy = top + Math.max(portrait ? cell * 1.0 : 0, (height - top - bottom - fieldH) / 2)
  return { width, height, portrait, cell, ox, oy, fieldW, fieldH }
}

// World (cell units, landscape grid) -> screen pixels.
export function toScreen(l: TdLayout, x: number, y: number): { sx: number; sy: number } {
  return l.portrait ? { sx: l.ox + y * l.cell, sy: l.oy + x * l.cell } : { sx: l.ox + x * l.cell, sy: l.oy + y * l.cell }
}

export function toWorld(l: TdLayout, sx: number, sy: number): { x: number; y: number } {
  const u = (sx - l.ox) / l.cell
  const v = (sy - l.oy) / l.cell
  return l.portrait ? { x: v, y: u } : { x: u, y: v }
}

// Heading conversion: a world angle (landscape) to a screen angle.
export function screenAngle(l: TdLayout, a: number): number {
  return l.portrait ? Math.atan2(Math.cos(a), Math.sin(a)) : a
}
