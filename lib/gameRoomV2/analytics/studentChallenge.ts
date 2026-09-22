import type { LearningEvent } from './mastery'
import { masteryByConcept } from './mastery'

// இன்றைய சவால் ("Today's Challenge"): picks which concept(s) a
// specific student would benefit from more practice on, using their
// own accuracy history -- never a class comparison, never a ranking
// against peers, and never surfaced with discouraging language (no
// "weak"/"fail"/"bad" anywhere in this file or its output; see
// suggestionMessage() below for the actual copy shown to the student).
//
// This is DELIBERATELY the same accuracy-threshold idea
// needingPractice.ts uses for the teacher's view, reused here for a
// single student rather than a whole class -- one shared, transparent
// rule for "does this concept need more practice", not two different
// heuristics that could disagree with each other.
const CHALLENGE_ACCURACY_THRESHOLD_PCT = 75
const CHALLENGE_MIN_ATTEMPTS = 2

export interface ChallengeConcept {
  concept: string
  accuracyPct: number
  attemptCount: number
}

// Returns up to `limit` concepts this student has practiced enough to
// judge, ordered by the most room for growth first (lowest accuracy),
// excluding any concept the student is already doing well on. Returns
// an empty array for a student with too little history to judge fairly
// -- the caller (the API route) falls back to a general "explore a new
// concept" prompt in that case, never a fabricated "you need practice
// on X" claim from insufficient data.
export function pickChallengeConcepts(studentEvents: LearningEvent[], limit = 3): ChallengeConcept[] {
  const summaries = masteryByConcept(studentEvents)

  return summaries
    .filter((s) => s.totalCount >= CHALLENGE_MIN_ATTEMPTS && s.accuracyPct < CHALLENGE_ACCURACY_THRESHOLD_PCT)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, limit)
    .map((s) => ({ concept: s.key, accuracyPct: s.accuracyPct, attemptCount: s.totalCount }))
}

// The actual copy shown to the student -- constructive framing only.
// Deliberately phrased as an invitation/opportunity ("Let's practice",
// "a little more practice", "keep building") rather than any
// evaluative label of the student themselves. This is the one place in
// the codebase that owns "how do we talk to a child about an area they
// haven't mastered yet" -- every caller (API route, UI) uses this
// function rather than composing its own message, so the tone stays
// consistent everywhere it appears.
export function challengeMessage(concepts: ChallengeConcept[]): string {
  if (concepts.length === 0) {
    return "Ready for something new? Today's challenge will pick a concept for you to explore."
  }
  if (concepts.length === 1) {
    return `Let's practice ${concepts[0].concept} today -- a little more practice will help it click!`
  }
  const names = concepts.map((c) => c.concept).join(', ')
  return `Today's challenge focuses on ${names} -- keep building on what you've already learned!`
}
