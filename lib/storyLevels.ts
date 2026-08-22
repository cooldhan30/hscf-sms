import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'

// Reuses the same Nilai/grade-level taxonomy as classes/students/
// resources (lib/constants.ts) rather than a separate scale, so a
// teacher picks the same "Nilai 3" they already know from the rest of
// the app. Word count, vocabulary, and sentence-structure guidance are
// defined together per level (not just a length number) since a story
// that's the right length but uses vocabulary too advanced (or too
// babyish) for that level defeats the point of the control.
//
// Nilai 1 is the SIMPLEST reading level in this ladder, not Mazhalai --
// confirmed directly by the user (a real correction to the first draft,
// which wrongly assumed Mazhalai was simpler purely from being the
// younger/pre-K label).
//
// A literal "max N letters per word" rule was tried and rejected --
// tested directly against Groq/Qwen and confirmed Tamil script can't
// satisfy a low hard character cap while staying meaningful (e.g.
// வாழை/banana is already 4 characters, சாப்பிட/eat is 7). Word
// simplicity is described qualitatively per level instead (word length/
// syllable count as guidance, not an enforced rule), the same way Tamil
// reading primers actually grade word difficulty.
export interface StoryLevelGuidance {
  wordCount: string
  vocabulary: string
  sentenceStructure: string
}

export const STORY_LEVEL_GUIDANCE: Record<string, StoryLevelGuidance> = {
  mazhalai: {
    wordCount: '5-10 words',
    vocabulary:
      'Only the simplest, shortest, most common Tamil words a preschooler already knows (e.g. பூ, நாய், அம்மா) -- single or two-syllable words only.',
    sentenceStructure: 'One idea per sentence, 2-4 words each.',
  },
  'grade-1': {
    wordCount: '10-15 words',
    vocabulary:
      'Very simple, short, everyday Tamil words a beginning reader would know from early primers. No compound or multi-syllable words.',
    sentenceStructure: 'Very short sentences, 2-4 words each.',
  },
  'grade-2': {
    wordCount: '15-20 words',
    vocabulary: 'Simple everyday words, still short and common; mostly two-syllable words.',
    sentenceStructure: 'Short sentences, mostly 4-6 words.',
  },
  'grade-3': {
    wordCount: '20-25 words',
    vocabulary: 'Everyday vocabulary with a few slightly longer common words.',
    sentenceStructure: 'Short-to-medium sentences; one simple connector is okay.',
  },
  'grade-4': {
    wordCount: '25-30 words',
    vocabulary: 'Broader everyday vocabulary, simple descriptive words.',
    sentenceStructure: 'Medium sentences, can combine two ideas.',
  },
  'grade-5': {
    wordCount: '30-50 words',
    vocabulary: 'Richer vocabulary, some descriptive/feeling words.',
    sentenceStructure: 'More varied sentence lengths, simple subordinate clauses.',
  },
  'grade-6': {
    wordCount: '50-60 words',
    vocabulary: 'Broader vocabulary that can include some abstract concepts.',
    sentenceStructure: 'Compound and simple complex sentences.',
  },
  'grade-7': {
    wordCount: '70-90 words',
    vocabulary: 'Advanced vocabulary appropriate for a strong reader; formal Tamil is acceptable.',
    sentenceStructure: 'Complex sentences with multiple clauses.',
  },
  'grade-8': {
    wordCount: '90-100 words',
    vocabulary: 'Near-fluent vocabulary range, literary phrasing allowed.',
    sentenceStructure: 'Sophisticated sentence structures, dialogue, varied pacing.',
  },
  'biliteracy-seal': {
    wordCount: '100-150 words',
    vocabulary: 'Full literary vocabulary range expected of a biliteracy-certified student.',
    sentenceStructure: 'Complex, essay-like narrative structures.',
  },
  'tamil-diploma': {
    wordCount: '150-200 words',
    vocabulary: 'Advanced/near-native vocabulary, including formal and literary registers.',
    sentenceStructure: 'Fully mature narrative prose.',
  },
}

export const STORY_LEVEL_VALUES = GRADE_LEVEL_OPTIONS.map((l) => l.value)
export type StoryLevel = (typeof STORY_LEVEL_VALUES)[number]

// Frontend-facing options -- same labels as GRADE_LEVEL_OPTIONS, so the
// dropdown reads identically to every other Nilai picker in the app.
export const STORY_LEVEL_OPTIONS = GRADE_LEVEL_OPTIONS
