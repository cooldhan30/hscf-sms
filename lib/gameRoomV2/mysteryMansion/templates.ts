// Reusable mystery TEMPLATES -- deliberately small and data-only (never
// a branching narrative engine, per the "avoid unnecessarily complex
// narrative engine" requirement). A template is just: what's missing,
// who the possible "who found it" suspects are, and where it's finally
// found. generator.ts picks one template plus one suspect/location
// combination per session, seeded from the session's own id, so
// replaying the same question set produces a *different* mystery
// each time without needing any new code -- new mysteries can be added
// later by appending to this array, never by touching generator logic.
export interface MysteryTemplate {
  id: string
  missingItem: string
  missingItemEmoji: string
  suspects: string[]
  resolutionText: (suspect: string, foundLocation: string) => string
}

export const MYSTERY_TEMPLATES: MysteryTemplate[] = [
  {
    id: 'heirloom-locket',
    missingItem: 'a golden locket',
    missingItemEmoji: '\u{1F4FF}',
    suspects: ['the gardener', 'the old butler', 'a curious cat', 'a visiting cousin'],
    resolutionText: (suspect, location) =>
      `The golden locket was never stolen at all -- ${suspect} had simply tucked it away in the ${location} for safekeeping, meaning no harm.`,
  },
  {
    id: 'missing-painting',
    missingItem: 'a small painting',
    missingItemEmoji: '\u{1F5BC}\u{FE0F}',
    suspects: ['the art restorer', 'a forgetful uncle', 'the household cat', 'the youngest sibling'],
    resolutionText: (suspect, location) =>
      `The painting had been taken down by ${suspect} for a careful cleaning, and was resting safely in the ${location} the whole time.`,
  },
  {
    id: 'vanished-diary',
    missingItem: 'an old diary',
    missingItemEmoji: '\u{1F4D3}',
    suspects: ['a curious niece', 'the housekeeper', 'the family dog', 'a visiting scholar'],
    resolutionText: (suspect, location) =>
      `${suspect} had borrowed the diary to read by candlelight, and left it, quite by accident, in the ${location}.`,
  },
  {
    id: 'lost-key',
    missingItem: 'a brass key',
    missingItemEmoji: '\u{1F5DD}\u{FE0F}',
    suspects: ['the locksmith\'s apprentice', 'a playful parrot', 'the twins next door', 'the mansion\'s caretaker'],
    resolutionText: (suspect, location) =>
      `The brass key turns out to have been moved by ${suspect}, who set it down in the ${location} and simply forgot.`,
  },
]

export function getMysteryTemplate(id: string): MysteryTemplate {
  const t = MYSTERY_TEMPLATES.find((m) => m.id === id)
  if (!t) throw new Error(`Unknown Mystery Mansion template: ${id}`)
  return t
}
