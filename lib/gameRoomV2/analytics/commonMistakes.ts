// Aggregates confusion_pair_key values (already computed per-answer by
// extractConfusionPair, persisted on sms_gamev2_learning_events) into
// class-wide "common mistakes" -- the concrete mechanism behind the
// request's flagship example: "7 students repeatedly confused ண/ந/ன".
export interface LearningEventWithConfusion {
  studentId: string
  confusionPairKey: string | null
}

export interface CommonMistake {
  pairKey: string
  studentIds: string[]
  occurrenceCount: number
}

// A mistake only counts as "common" once at least MIN_STUDENTS
// distinct students have made it -- one student mixing up two letters
// once is normal learning noise, not a class-wide pattern a teacher
// needs to address. Both numbers are plain, documented constants (not
// a hidden heuristic), matching the same transparency bar
// needingPractice.ts's threshold already sets.
const COMMON_MISTAKE_MIN_STUDENTS = 3

export function commonMistakes(events: LearningEventWithConfusion[]): CommonMistake[] {
  const byPair = new Map<string, { studentIds: Set<string>; occurrenceCount: number }>()

  for (const event of events) {
    if (!event.confusionPairKey) continue
    const entry = byPair.get(event.confusionPairKey) ?? { studentIds: new Set<string>(), occurrenceCount: 0 }
    entry.studentIds.add(event.studentId)
    entry.occurrenceCount++
    byPair.set(event.confusionPairKey, entry)
  }

  return Array.from(byPair.entries())
    .map(([pairKey, entry]) => ({ pairKey, studentIds: Array.from(entry.studentIds), occurrenceCount: entry.occurrenceCount }))
    .filter((m) => m.studentIds.length >= COMMON_MISTAKE_MIN_STUDENTS)
    .sort((a, b) => b.studentIds.length - a.studentIds.length)
}
