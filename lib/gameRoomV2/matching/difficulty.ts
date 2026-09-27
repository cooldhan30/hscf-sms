// Matching's Casual/Quick/Speedster -- alters gameplay parameters only
// (whether moves are lightly time-pressured via a visible round timer,
// and the streak bonus multiplier for consecutive correct pairs).
// Question difficulty and pair content always come from the selected
// Question Set, never touched here -- the same separation every V2
// engine establishes.
export type MatchingDifficulty = 'casual' | 'quick' | 'speedster'

export interface MatchingDifficultySettings {
  id: MatchingDifficulty
  label: string
  description: string
  // Whether a per-round countdown applies pressure -- Casual has none
  // (unlimited time to look/think), Quick/Speedster do.
  roundTimeLimitSeconds: number | null
  streakBonusPerStep: number
}

export const MATCHING_DIFFICULTY_SETTINGS: MatchingDifficultySettings[] = [
  {
    id: 'casual',
    label: 'Casual',
    description: 'நேரக் கட்டுப்பாடு இல்லை -- நிதானமாக ஒவ்வொரு இணையையும் கண்டுபிடியுங்கள்.',
    roundTimeLimitSeconds: null,
    streakBonusPerStep: 5,
  },
  {
    id: 'quick',
    label: 'Quick',
    description: 'மென்மையான நேரக் கட்டுப்பாடு ஆட்டத்தை நகர்த்திக்கொண்டே இருக்கும்.',
    roundTimeLimitSeconds: 45,
    streakBonusPerStep: 8,
  },
  {
    id: 'speedster',
    label: 'Speedster',
    description: 'இறுக்கமான நேரம், உண்மையான வேகச் சவால் -- பெரிய தொடர் வெற்றிப் பரிசுகளுடன்.',
    roundTimeLimitSeconds: 25,
    streakBonusPerStep: 12,
  },
]

export function getMatchingDifficultySettings(id: MatchingDifficulty): MatchingDifficultySettings {
  const d = MATCHING_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Matching difficulty: ${id}`)
  return d
}

// "Progressively harder rounds": each successive MATCH question in the
// session tightens the round timer slightly (never below a usable
// floor), so round 4 feels noticeably snappier than round 1 even
// though the underlying difficulty tier never changes mid-session.
// roundIndex is 0-based (the session's own currentIndex).
const MIN_ROUND_TIME_LIMIT_SECONDS = 12
const TIME_LIMIT_REDUCTION_PER_ROUND_SECONDS = 3

export function roundTimeLimitForIndex(settings: MatchingDifficultySettings, roundIndex: number): number | null {
  if (settings.roundTimeLimitSeconds === null) return null
  const reduced = settings.roundTimeLimitSeconds - roundIndex * TIME_LIMIT_REDUCTION_PER_ROUND_SECONDS
  return Math.max(MIN_ROUND_TIME_LIMIT_SECONDS, reduced)
}
