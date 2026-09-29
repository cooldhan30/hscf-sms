// Trace & Learn: how well a child traced a letter. Both the letter's shape
// and the child's strokes are reduced to the same small grid of cells
// (true = ink); the trace passes when enough of the letter is covered and
// not too much of the drawing wandered off it. Practice only -- this runs
// on the device and earns stars on screen, never server XP.

export interface TraceScore {
  // Share of the letter's cells the child drew over (0..1)
  coverage: number
  // Share of the child's cells that are nowhere near the letter (0..1)
  stray: number
  passed: boolean
}

export const TRACE_PASS = { coverage: 0.55, stray: 0.35 }

// Grow the letter's cells by `r` so a slightly-off stroke still counts as
// "on the letter" (little fingers aren't precise).
function dilate(cells: boolean[], size: number, r: number): boolean[] {
  const out = new Array<boolean>(cells.length).fill(false)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!cells[y * size + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < size && ny < size) out[ny * size + nx] = true
        }
      }
    }
  }
  return out
}

export function scoreTrace(letter: boolean[], strokes: boolean[], size: number): TraceScore {
  const letterCount = letter.filter(Boolean).length
  const strokeCount = strokes.filter(Boolean).length
  if (letterCount === 0 || strokeCount === 0) return { coverage: 0, stray: strokeCount === 0 ? 0 : 1, passed: false }
  // A stroke "covers" a letter cell if it's within one cell of it
  const nearStroke = dilate(strokes, size, 1)
  const covered = letter.filter((on, i) => on && nearStroke[i]).length
  const nearLetter = dilate(letter, size, 2)
  const strayCount = strokes.filter((on, i) => on && !nearLetter[i]).length
  const coverage = covered / letterCount
  const stray = strayCount / strokeCount
  return { coverage, stray, passed: coverage >= TRACE_PASS.coverage && stray <= TRACE_PASS.stray }
}
