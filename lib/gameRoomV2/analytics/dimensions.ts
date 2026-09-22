// The 7 learning dimensions the request names -- a fixed, small enum
// (mirrored by a DB CHECK on sms_gamev2_questions.dimension, migration
// 078) since a genuinely new dimension is a curriculum decision, not a
// per-release registry addition like a game engine id.
export const LEARNING_DIMENSIONS = ['reading', 'vocabulary', 'listening', 'grammar', 'writing', 'spelling', 'comprehension'] as const
export type LearningDimension = (typeof LEARNING_DIMENSIONS)[number]

export const DIMENSION_LABELS: Record<LearningDimension, { name: string; tamilName: string }> = {
  reading: { name: 'Reading', tamilName: 'வாசிப்பு' },
  vocabulary: { name: 'Vocabulary', tamilName: 'சொல்வளம்' },
  listening: { name: 'Listening', tamilName: 'செவிமடுத்தல்' },
  grammar: { name: 'Grammar', tamilName: 'இலக்கணம்' },
  writing: { name: 'Writing', tamilName: 'எழுத்து' },
  spelling: { name: 'Spelling', tamilName: 'எழுத்துப் பிழை திருத்தம்' },
  comprehension: { name: 'Comprehension', tamilName: 'புரிதல்' },
}

export function isLearningDimension(value: unknown): value is LearningDimension {
  return typeof value === 'string' && (LEARNING_DIMENSIONS as readonly string[]).includes(value)
}

// A question's EFFECTIVE dimension for analytics purposes: its own
// per-question dimension if a teacher set one, otherwise null -- this
// deliberately does NOT fall back to guessing a dimension from the
// parent set's free-text `subject` (e.g. a set with subject: "Grammar"
// does not imply every question in it is dimension: 'grammar', since
// subject is uncontrolled free text a teacher could spell any way).
// A question with no asserted dimension is simply excluded from
// dimension-specific rollups -- see achievementRules.ts's sibling
// principle of never fabricating a signal that wasn't actually
// server-verified; here the equivalent is never fabricating a
// dimension that wasn't actually teacher-asserted. This keeps "keep
// mastery algorithms transparent and testable" true: every dimension
// number a teacher sees traces back to an explicit tag, never an
// inference.
export function effectiveDimension(question: { dimension: string | null }): LearningDimension | null {
  return isLearningDimension(question.dimension) ? question.dimension : null
}

// A question's EFFECTIVE concept tags: its own per-question
// concept_tags if any were set, otherwise the parent set's `tags` as a
// coarser fallback (a teacher who tags concepts at the SET level, e.g.
// because every question in a short set tests the same concept, still
// gets concept-level analytics -- just at set granularity instead of
// per-question). This fallback is safe (unlike dimension's) because
// `tags` and `concept_tags` are the same kind of thing -- free-text
// concept/topic labels -- whereas `subject` is a broader curriculum
// label that doesn't map 1:1 onto a specific concept the way a tag
// does.
export function effectiveConceptTags(question: { conceptTags: string[] }, questionSet: { tags: string[] }): string[] {
  return question.conceptTags.length > 0 ? question.conceptTags : questionSet.tags
}
