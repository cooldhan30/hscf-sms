// Balloon Pop (பலூன் உடைப்போம்) -- the first Little Learners game (ages
// 4-9). Each question's answer options ride up the sky in balloons; the
// child taps one to pop it. No timer, no lives, no game over: a balloon
// that floats off the top comes back up from the bottom, and a wrong pop
// just shows the right balloon before moving on. Grading stays on the
// server (/answer) like every engine; this module is pure and holds only
// what the balloons look like and where they are.

export interface BalloonOption {
  key: string
  // What the balloon shows
  label: string
  imageUrl?: string
  // Sent to /answer as-is -- must match what gradeAnswer expects per type
  answer: string | boolean
}

export interface KidsQuestion {
  questionType: string
  payload: Record<string, unknown>
}

// The question types Balloon Pop plays (registry supportedQuestionTypes).
export const BALLOON_QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'AUDIO_CHOICE'] as const

export function balloonOptions(q: KidsQuestion): BalloonOption[] {
  const p = q.payload ?? {}
  switch (q.questionType) {
    case 'MULTIPLE_CHOICE':
    case 'AUDIO_CHOICE':
      return ((p.options as string[]) ?? []).map((o, i) => ({ key: `o${i}`, label: o, answer: o }))
    case 'IMAGE_CHOICE':
      return ((p.options as { imageUrl: string; label?: string }[]) ?? []).map((o, i) => ({
        key: `o${i}`,
        label: o.label ?? '',
        imageUrl: o.imageUrl,
        answer: o.imageUrl,
      }))
    case 'TRUE_FALSE':
      return [
        { key: 'true', label: 'சரி ✓', answer: true },
        { key: 'false', label: 'தவறு ✗', answer: false },
      ]
    default:
      return []
  }
}

// Does this option match the correctAnswer text /answer reveals after a
// wrong pop? (IMAGE_CHOICE reveals the image's label; TRUE_FALSE 'True'/'False'.)
export function isRevealedAnswer(option: BalloonOption, revealed: string | null): boolean {
  if (revealed === null) return false
  if (typeof option.answer === 'boolean') return (option.answer ? 'True' : 'False') === revealed
  return option.answer === revealed || (option.label !== '' && option.label === revealed)
}

// Bright, friendly balloon colours (fill, darker knot/shadow)
export const BALLOON_COLORS: [string, string][] = [
  ['#f43f5e', '#be123c'], // pink-red
  ['#3b82f6', '#1d4ed8'], // blue
  ['#f59e0b', '#b45309'], // orange
  ['#22c55e', '#15803d'], // green
  ['#a855f7', '#7e22ce'], // purple
  ['#06b6d4', '#0e7490'], // teal
]

// Seconds for one balloon to rise from below the grass to above the sky.
// Slow on purpose: a 4-year-old needs time to find the right letter.
export const RISE_SECONDS = [15, 17, 16, 18]

export interface BalloonPos {
  // 0..100 across the play area (balloon centre)
  x: number
  // 0 = top of the play area, 100 = bottom; runs past both edges
  y: number
  // Small sideways sway in degrees for the tilt
  tilt: number
}

// Where balloon `index` of `count` is at `tMs` into the question. Usually
// every balloon gets its own lane; with fewer `lanes` than balloons (long
// answer words on a phone) two balloons share a lane, half a rise apart,
// so each can be twice as wide. Starts are staggered so they never overlap
// and the first ones are already in view when the question appears.
export function balloonPosition(index: number, count: number, tMs: number, reducedMotion: boolean, lanes: number = count): BalloonPos {
  const laneCount = Math.max(1, Math.min(lanes, count))
  const laneIdx = index % laneCount
  const row = Math.floor(index / laneCount)
  const x = 8 + ((laneIdx + 0.5) / laneCount) * 84
  if (reducedMotion) {
    // Still: one row across the middle of the sky (two rows when lanes are shared)
    return laneCount < count ? { x, y: 30 + row * 40, tilt: 0 } : { x, y: 52 + (index % 2) * 8, tilt: 0 }
  }
  const period = (laneCount < count ? RISE_SECONDS[laneIdx % RISE_SECONDS.length] : RISE_SECONDS[index % RISE_SECONDS.length]) * 1000
  // Staggered starting heights; balloons sharing a lane are half a rise apart
  const startFrac = laneCount < count ? ([0.35, 0.6][laneIdx % 2] + row * 0.5) % 1 : [0.35, 0.6, 0.45, 0.7][index % 4]
  const frac = ((tMs / period + startFrac) % 1 + 1) % 1
  const y = 118 - frac * 150 // 118 (below grass) -> -32 (above sky)
  const swaySec = 3.2 + index * 0.45
  const swayPhase = (tMs / 1000 / swaySec) * Math.PI * 2 + index
  return { x: x + Math.sin(swayPhase) * 2.2, y, tilt: Math.sin(swayPhase + 0.6) * 6 }
}

// Longest label length in visible letters (combining marks dropped)
export function visibleLength(label: string): number {
  return label.replace(/[\u0B82\u0BBE-\u0BCD\u0BD7\u200C\u200D\s✓✗]/g, '').length
}

// Text size step for a label: 1 = a single Tamil letter (huge) ... 5 = a
// long word like "உயிர்மெய்யெழுத்து". Letter count drops combining marks
// (Tamil vowel signs, virama). The component turns the step into a size
// relative to the balloon, then fine-fits it.
export function labelSizeStep(label: string): 1 | 2 | 3 | 4 | 5 {
  const visible = visibleLength(label)
  if (visible <= 1) return 1
  if (visible <= 2) return 2
  if (visible <= 4) return 3
  if (visible <= 7) return 4
  return 5
}

// Friendly words after a correct pop (Tamil first, English second)
export const PRAISE: [string, string][] = [
  ['அருமை!', 'Great!'],
  ['சூப்பர்!', 'Super!'],
  ['நன்று!', 'Well done!'],
  ['அசத்தல்!', 'Amazing!'],
  ['சபாஷ்!', 'Bravo!'],
]
