// Little Learners (ages 4-9) -- the pure logic every kids' game shares:
// turning a question into things a child can tap (balloons, carriages,
// fish, parachutes, tiles), matching the answer /answer reveals after a
// wrong tap, praise words, and how big a label should be. Grading always
// stays on the server; nothing here decides right or wrong.

export interface KidsQuestion {
  questionType: string
  prompt?: string
  payload: Record<string, unknown>
}

export interface ChoiceOption {
  key: string
  // What the child sees
  label: string
  imageUrl?: string
  // Sent to /answer as-is -- must match what gradeAnswer expects per type
  answer: string | boolean
}

// The "pick one" question types the tap games play.
export const CHOICE_QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'AUDIO_CHOICE'] as const

export function choiceOptions(q: KidsQuestion): ChoiceOption[] {
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
// wrong tap? (IMAGE_CHOICE reveals the image's label; TRUE_FALSE 'True'/'False'.)
export function isRevealedAnswer(option: ChoiceOption, revealed: string | null): boolean {
  if (revealed === null) return false
  if (typeof option.answer === 'boolean') return (option.answer ? 'True' : 'False') === revealed
  return option.answer === revealed || (option.label !== '' && option.label === revealed)
}

// Friendly words after a right answer (Tamil first, English second)
export const PRAISE: [string, string][] = [
  ['அருமை!', 'Great!'],
  ['சூப்பர்!', 'Super!'],
  ['நன்று!', 'Well done!'],
  ['அசத்தல்!', 'Amazing!'],
  ['சபாஷ்!', 'Bravo!'],
]

// Bright colours for things kids tap (fill, darker shade)
export const KID_COLORS: [string, string][] = [
  ['#f43f5e', '#be123c'], // pink-red
  ['#3b82f6', '#1d4ed8'], // blue
  ['#f59e0b', '#b45309'], // orange
  ['#22c55e', '#15803d'], // green
  ['#a855f7', '#7e22ce'], // purple
  ['#06b6d4', '#0e7490'], // teal
]

// Label length in visible letters: Tamil combining marks (vowel signs,
// virama), zero-width joiners and spaces don't take their own space.
export function visibleLength(label: string): number {
  return label.replace(/[\u0B82\u0BBE-\u0BCD\u0BD7\u200C\u200D\s✓✗]/g, '').length
}

// Text size step: 1 = a single letter (huge) ... 5 = a long word like
// "உயிர்மெய்யெழுத்து". Components map the step to a size relative to the
// thing it sits on (Tailwind classes can't live in lib/: it isn't scanned).
export function labelSizeStep(label: string): 1 | 2 | 3 | 4 | 5 {
  const visible = visibleLength(label)
  if (visible <= 1) return 1
  if (visible <= 2) return 2
  if (visible <= 4) return 3
  if (visible <= 7) return 4
  return 5
}

export function hasLongLabels(options: { label: string; imageUrl?: string }[], over = 4): boolean {
  return options.some((o) => !o.imageUrl && visibleLength(o.label) > over)
}
