import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

// Reuses the same Nilai/grade-level taxonomy as classes/students/
// resources (lib/constants.ts) rather than a separate scale, so a
// teacher picks the same "Nilai 3" they already know from the rest of
// the app. Word count, vocabulary, and sentence-structure guidance are
// defined together per level (not just a length number) since a story
// that's the right length but uses vocabulary too advanced (or too
// babyish) for that level defeats the point of the control -- reviewed
// and confirmed level-by-level before going live, not guessed.
export interface StoryLevelGuidance {
  wordCount: string
  vocabulary: string
  sentenceStructure: string
}

export const STORY_LEVEL_GUIDANCE: Record<string, StoryLevelGuidance> = {
  mazhalai: {
    wordCount: '20-40 words',
    vocabulary:
      'Only the most basic, everyday Tamil words a preschooler would already know (family, animals, colors, simple objects). No compound or abstract words.',
    sentenceStructure: 'Very short sentences (3-6 words), present tense, one idea per sentence.',
  },
  'grade-1': {
    wordCount: '40-70 words',
    vocabulary: 'Simple, common Tamil words used in early reading primers. Avoid literary/formal Tamil.',
    sentenceStructure: 'Short sentences, mostly simple subject-verb-object, minimal connectors.',
  },
  'grade-2': {
    wordCount: '70-100 words',
    vocabulary:
      'Slightly broader everyday vocabulary; a few new/slightly challenging words are okay if context makes the meaning clear.',
    sentenceStructure: 'Short-to-medium sentences; simple connectors like "then" and "because" are allowed.',
  },
  'grade-3': {
    wordCount: '100-150 words',
    vocabulary: 'Everyday vocabulary plus some descriptive words (feelings, simple nature/school words).',
    sentenceStructure: 'Medium sentences; can combine two short ideas with a connector.',
  },
  'grade-4': {
    wordCount: '150-200 words',
    vocabulary: 'More descriptive vocabulary; simple idioms are okay if common.',
    sentenceStructure: 'More varied sentence lengths; simple subordinate clauses okay ("when", "if").',
  },
  'grade-5': {
    wordCount: '200-250 words',
    vocabulary: 'Richer vocabulary including some formal/written Tamil words alongside spoken ones.',
    sentenceStructure: 'Compound and simple complex sentences; more descriptive detail.',
  },
  'grade-6': {
    wordCount: '250-300 words',
    vocabulary: 'Broader vocabulary that can include some abstract concepts and mild literary phrasing.',
    sentenceStructure: 'Complex sentences with multiple clauses; more sophisticated narrative structure.',
  },
  'grade-7': {
    wordCount: '300-400 words',
    vocabulary: 'Advanced vocabulary appropriate for a strong intermediate reader; formal Tamil is acceptable.',
    sentenceStructure: 'Longer, more complex sentences; can include dialogue and varied narrative techniques.',
  },
  'grade-8': {
    wordCount: '350-450 words',
    vocabulary: 'Near-fluent vocabulary range, including some literary/classical Tamil expressions.',
    sentenceStructure: 'Sophisticated sentence structures, varied pacing, can include figurative language.',
  },
  'biliteracy-seal': {
    wordCount: '400-500 words',
    vocabulary: 'Full literary vocabulary range expected of a biliteracy-certified student; nuanced word choice.',
    sentenceStructure: 'Complex, essay-like narrative structures; sustained, sophisticated prose.',
  },
  'tamil-diploma': {
    wordCount: '450-600 words',
    vocabulary: 'Advanced/near-native vocabulary, including formal and literary registers.',
    sentenceStructure: 'Fully mature narrative prose, complex multi-clause sentences, stylistic variety.',
  },
}

export const STORY_LEVEL_VALUES = GRADE_LEVEL_OPTIONS.map((l) => l.value)
export type StoryLevel = (typeof STORY_LEVEL_VALUES)[number]

// Frontend-facing options -- same labels as GRADE_LEVEL_OPTIONS, so the
// dropdown reads identically to every other Nilai picker in the app.
export const STORY_LEVEL_OPTIONS = GRADE_LEVEL_OPTIONS
