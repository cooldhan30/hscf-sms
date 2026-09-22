import type { LearningDimension } from './dimensions'

// A single learning event, exactly the shape persisted to
// sms_gamev2_learning_events -- every mastery/report function in this
// file takes a plain array of these and is a pure function of it, so
// the SAME function that computes a teacher's class report can be
// handed fabricated data in a test and produce a provably correct
// result. No function here queries a database itself.
export interface LearningEvent {
  studentId: string
  dimension: LearningDimension | null
  conceptTags: string[]
  isCorrect: boolean
  responseTimeMs: number
  answeredAt: string
}

// Mastery is expressed as a plain accuracy percentage plus the raw
// counts behind it -- deliberately NOT a hidden composite score or a
// black-box "mastery level" -- so "keep mastery algorithms transparent
// and testable" is true by construction: a teacher (or a test) can
// always recompute correctCount/totalCount -> accuracyPct by hand and
// get the exact same number this function returns.
export interface MasterySummary {
  key: string
  correctCount: number
  totalCount: number
  accuracyPct: number
}

function summarize(key: string, events: LearningEvent[]): MasterySummary {
  const totalCount = events.length
  const correctCount = events.filter((e) => e.isCorrect).length
  return {
    key,
    correctCount,
    totalCount,
    accuracyPct: totalCount > 0 ? Math.round((correctCount / totalCount) * 1000) / 10 : 0,
  }
}

// Groups events by dimension and computes each dimension's mastery.
// Events with no dimension (question never tagged) are silently
// excluded -- never counted toward any dimension's total, per
// dimensions.ts's "never fabricate a signal that wasn't asserted"
// principle.
export function masteryByDimension(events: LearningEvent[]): MasterySummary[] {
  const byDimension = new Map<string, LearningEvent[]>()
  for (const event of events) {
    if (!event.dimension) continue
    const list = byDimension.get(event.dimension) ?? []
    list.push(event)
    byDimension.set(event.dimension, list)
  }
  return Array.from(byDimension.entries())
    .map(([dimension, list]) => summarize(dimension, list))
    .sort((a, b) => a.key.localeCompare(b.key))
}

// Groups events by concept tag. An event with multiple concept tags
// (e.g. a question tagged both "திணை" and "எண்") contributes to BOTH
// concepts' totals -- a question genuinely testing two concepts at
// once should count toward mastery of each, not force an arbitrary
// single-concept assignment.
export function masteryByConcept(events: LearningEvent[]): MasterySummary[] {
  const byConcept = new Map<string, LearningEvent[]>()
  for (const event of events) {
    for (const concept of event.conceptTags) {
      const list = byConcept.get(concept) ?? []
      list.push(event)
      byConcept.set(concept, list)
    }
  }
  return Array.from(byConcept.entries())
    .map(([concept, list]) => summarize(concept, list))
    .sort((a, b) => b.totalCount - a.totalCount)
}

// A single student's mastery for one specific concept -- the building
// block behind "students needing practice" (see needingPractice.ts):
// filters to one student before summarizing.
export function masteryForStudentAndConcept(events: LearningEvent[], studentId: string, concept: string): MasterySummary {
  const filtered = events.filter((e) => e.studentId === studentId && e.conceptTags.includes(concept))
  return summarize(concept, filtered)
}

// Improvement over time: splits events (already sorted or not -- this
// sorts them itself by answeredAt) into two halves by time and compares
// accuracy between them. Returns null if there isn't enough history to
// meaningfully compare (fewer than 2 events total), rather than
// reporting a misleading 0% -> 100% swing from a single data point.
export interface ImprovementResult {
  earlierAccuracyPct: number
  laterAccuracyPct: number
  deltaPct: number
  earlierCount: number
  laterCount: number
}

export function improvementOverTime(events: LearningEvent[]): ImprovementResult | null {
  if (events.length < 2) return null
  const sorted = [...events].sort((a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime())
  const midpoint = Math.floor(sorted.length / 2)
  const earlier = summarize('earlier', sorted.slice(0, midpoint))
  const later = summarize('later', sorted.slice(midpoint))
  return {
    earlierAccuracyPct: earlier.accuracyPct,
    laterAccuracyPct: later.accuracyPct,
    deltaPct: Math.round((later.accuracyPct - earlier.accuracyPct) * 10) / 10,
    earlierCount: earlier.totalCount,
    laterCount: later.totalCount,
  }
}
