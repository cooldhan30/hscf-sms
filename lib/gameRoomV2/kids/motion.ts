// Where the moving things in the tap games are at time t. All paths loop
// forever and are slow on purpose: a 4-year-old needs time to find the
// right letter. Positions are percentages of the play area (x across,
// y down; values past 0/100 are off screen). Several things can share a
// lane (long words on a phone) -- they then run half a loop apart.

export interface KidPos {
  x: number
  y: number
  tilt: number
  // Swimming direction for fish (1 = right, -1 = left)
  dir?: 1 | -1
}

function laneOf(index: number, count: number, lanes: number) {
  const laneCount = Math.max(1, Math.min(lanes, count))
  return { laneCount, lane: index % laneCount, row: Math.floor(index / laneCount), shared: laneCount < count }
}

// Staggered starting points so the first ones are already in view
const START = [0.35, 0.6, 0.45, 0.7]
const SECONDS = [15, 17, 16, 18]

function loopFrac(index: number, tMs: number, periodS: number, lane: number, row: number, shared: boolean) {
  const start = shared ? ([0.35, 0.6][lane % 2] + row * 0.5) % 1 : START[index % 4]
  return (((tMs / (periodS * 1000) + start) % 1) + 1) % 1
}

// Balloons rise from below the grass to above the sky
export function risePosition(index: number, count: number, tMs: number, reduced: boolean, lanes: number = count): KidPos {
  const { laneCount, lane, row, shared } = laneOf(index, count, lanes)
  const x = 8 + ((lane + 0.5) / laneCount) * 84
  if (reduced) return shared ? { x, y: 30 + row * 40, tilt: 0 } : { x, y: 52 + (index % 2) * 8, tilt: 0 }
  const period = SECONDS[(shared ? lane : index) % SECONDS.length]
  const frac = loopFrac(index, tMs, period, lane, row, shared)
  const swaySec = 3.2 + index * 0.45
  const sway = (tMs / 1000 / swaySec) * Math.PI * 2 + index
  return { x: x + Math.sin(sway) * 2.2, y: 118 - frac * 150, tilt: Math.sin(sway + 0.6) * 6 }
}

// Parachutes drift down from above the sky, swinging gently
export function fallPosition(index: number, count: number, tMs: number, reduced: boolean, lanes: number = count): KidPos {
  const { laneCount, lane, row, shared } = laneOf(index, count, lanes)
  const x = 8 + ((lane + 0.5) / laneCount) * 84
  if (reduced) return shared ? { x, y: 28 + row * 40, tilt: 0 } : { x, y: 42 + (index % 2) * 10, tilt: 0 }
  const period = SECONDS[(shared ? lane : index) % SECONDS.length] + 2
  const frac = loopFrac(index, tMs, period, lane, row, shared)
  const swingSec = 3.6 + index * 0.4
  const swing = Math.sin((tMs / 1000 / swingSec) * Math.PI * 2 + index)
  return { x: x + swing * 3, y: -30 + frac * 145, tilt: swing * 9 }
}

// Fish swim across the pond in rows, alternating direction, bobbing a little
export function swimPosition(index: number, count: number, tMs: number, reduced: boolean): KidPos {
  const rows = Math.max(1, count)
  const y = 12 + ((index + 0.5) / rows) * 76
  const dir: 1 | -1 = index % 2 === 0 ? 1 : -1
  if (reduced) return { x: 20 + (index % 2) * 45 + 10, y, tilt: 0, dir }
  // A little slower than balloons: fish cross the whole width
  const period = SECONDS[index % SECONDS.length] + 3
  const frac = (((tMs / (period * 1000) + START[index % 4]) % 1) + 1) % 1
  const x = dir === 1 ? -18 + frac * 136 : 118 - frac * 136
  const bob = Math.sin((tMs / 1000 / (2.4 + index * 0.3)) * Math.PI * 2 + index)
  return { x, y: y + bob * 1.5, tilt: bob * 4, dir }
}
