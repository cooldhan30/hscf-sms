import { masteryByConcept, type LearningEvent, type MasterySummary } from './mastery'

// "Students needing practice" for one concept: any student whose
// per-concept accuracy falls below the threshold, with a minimum
// attempt count so a single unlucky wrong answer doesn't flag a
// student who has barely touched the concept yet -- a transparent,
// two-number rule (threshold + minimum attempts), not a hidden
// weighting scheme.
const NEEDS_PRACTICE_ACCURACY_THRESHOLD_PCT = 70
const NEEDS_PRACTICE_MIN_ATTEMPTS = 3

export interface StudentNeedingPractice {
  studentId: string
  accuracyPct: number
  correctCount: number
  totalCount: number
}

// Given every learning event for a class on ONE concept, returns which
// students meet the "needs practice" bar -- sorted weakest-accuracy
// first, since that's the order a teacher would want to intervene in.
export function studentsNeedingPracticeForConcept(events: LearningEvent[], concept: string): StudentNeedingPractice[] {
  const relevant = events.filter((e) => e.conceptTags.includes(concept))
  const byStudent = new Map<string, LearningEvent[]>()
  for (const event of relevant) {
    const list = byStudent.get(event.studentId) ?? []
    list.push(event)
    byStudent.set(event.studentId, list)
  }

  const results: StudentNeedingPractice[] = []
  for (const [studentId, studentEvents] of Array.from(byStudent.entries())) {
    const totalCount = studentEvents.length
    if (totalCount < NEEDS_PRACTICE_MIN_ATTEMPTS) continue
    const correctCount = studentEvents.filter((e) => e.isCorrect).length
    const accuracyPct = Math.round((correctCount / totalCount) * 1000) / 10
    if (accuracyPct < NEEDS_PRACTICE_ACCURACY_THRESHOLD_PCT) {
      results.push({ studentId, accuracyPct, correctCount, totalCount })
    }
  }

  return results.sort((a, b) => a.accuracyPct - b.accuracyPct)
}

// Every concept where AT LEAST ONE student currently needs practice,
// ranked by how many students are struggling -- the concrete input to
// a "Topics needing attention" teacher dashboard section, computed
// entirely from masteryByConcept's already-tested aggregation rather
// than a separate ad hoc pass over the same data.
export interface ConceptNeedingAttention {
  concept: string
  studentsNeedingPractice: StudentNeedingPractice[]
  classSummary: MasterySummary
}

export function conceptsNeedingAttention(events: LearningEvent[]): ConceptNeedingAttention[] {
  const conceptSummaries = masteryByConcept(events)
  const results: ConceptNeedingAttention[] = []

  for (const summary of conceptSummaries) {
    const struggling = studentsNeedingPracticeForConcept(events, summary.key)
    if (struggling.length > 0) {
      results.push({ concept: summary.key, studentsNeedingPractice: struggling, classSummary: summary })
    }
  }

  return results.sort((a, b) => b.studentsNeedingPractice.length - a.studentsNeedingPractice.length)
}
