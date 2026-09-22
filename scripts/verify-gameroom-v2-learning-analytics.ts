// Standalone verification script for GameRoom V2's learning analytics
// domain (lib/gameRoomV2/analytics/*): dimension/concept resolution,
// mastery aggregation, students-needing-practice detection, common-
// mistake (confusion pair) detection, and the student-facing daily
// challenge concept picker. Same tsx-script convention as every other
// verify-gameroom-v2-*.ts script -- every function here is pure, so
// every assertion below is fully deterministic given fabricated data.
//
// Run with: npx tsx scripts/verify-gameroom-v2-learning-analytics.ts

import { effectiveDimension, effectiveConceptTags, isLearningDimension, LEARNING_DIMENSIONS } from '../lib/gameRoomV2/analytics/dimensions'
import { CONCEPT_SUGGESTIONS, getConceptSuggestionByTamilName } from '../lib/gameRoomV2/analytics/concepts'
import { masteryByDimension, masteryByConcept, masteryForStudentAndConcept, improvementOverTime, type LearningEvent } from '../lib/gameRoomV2/analytics/mastery'
import { studentsNeedingPracticeForConcept, conceptsNeedingAttention } from '../lib/gameRoomV2/analytics/needingPractice'
import { extractConfusionPair, confusionPairKey } from '../lib/gameRoomV2/analytics/confusionPairs'
import { commonMistakes } from '../lib/gameRoomV2/analytics/commonMistakes'
import { pickChallengeConcepts, challengeMessage } from '../lib/gameRoomV2/analytics/studentChallenge'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

function event(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    studentId: 'student-1',
    dimension: 'grammar',
    conceptTags: [],
    isCorrect: true,
    responseTimeMs: 5000,
    answeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

console.log('== Dimension resolution: never fabricated ==')
assert(LEARNING_DIMENSIONS.length === 7, `exactly 7 learning dimensions declared (found ${LEARNING_DIMENSIONS.length})`)
assert(isLearningDimension('grammar'), "'grammar' is a valid dimension")
assert(!isLearningDimension('mathematics'), "'mathematics' (not one of the 7) is not a valid dimension")
assert(effectiveDimension({ dimension: 'reading' }) === 'reading', 'a question with an asserted dimension resolves to it')
assert(effectiveDimension({ dimension: null }) === null, 'a question with no dimension resolves to null, never a guess')
assert(effectiveDimension({ dimension: 'not-a-real-dimension' }) === null, 'an invalid/corrupt dimension value resolves to null rather than throwing')

console.log('\n== Concept tag fallback: per-question first, then set-level ==')
assert(
  JSON.stringify(effectiveConceptTags({ conceptTags: ['திணை'] }, { tags: ['Grammar'] })) === JSON.stringify(['திணை']),
  'a question with its own concept tags uses them, ignoring the set tags'
)
assert(
  JSON.stringify(effectiveConceptTags({ conceptTags: [] }, { tags: ['Grammar', 'Thinai'] })) === JSON.stringify(['Grammar', 'Thinai']),
  'a question with NO concept tags falls back to the parent set\'s tags'
)
assert(JSON.stringify(effectiveConceptTags({ conceptTags: [] }, { tags: [] })) === '[]', 'no tags anywhere resolves to an empty list, never invented content')

console.log('\n== Concept catalog ==')
assert(CONCEPT_SUGGESTIONS.length === 8, `all 8 example concepts from the request are in the starter catalog (found ${CONCEPT_SUGGESTIONS.length})`)
assert(getConceptSuggestionByTamilName('திணை')?.englishName === 'Rational/irrational noun class', 'திணை resolves to its English gloss')
assert(getConceptSuggestionByTamilName('ஒரு கண்டுபிடிக்கப்படாத கருத்து') === undefined, 'an unrecognized concept string returns undefined rather than throwing')

console.log('\n== Mastery by dimension: transparent accuracy math ==')
const dimensionEvents: LearningEvent[] = [
  event({ dimension: 'grammar', isCorrect: true }),
  event({ dimension: 'grammar', isCorrect: true }),
  event({ dimension: 'grammar', isCorrect: false }),
  event({ dimension: 'vocabulary', isCorrect: true }),
  event({ dimension: null, isCorrect: false }), // untagged -- must be excluded entirely
]
const dimMastery = masteryByDimension(dimensionEvents)
const grammarMastery = dimMastery.find((m) => m.key === 'grammar')!
assert(grammarMastery.totalCount === 3, 'grammar dimension counts exactly its 3 tagged events, not the untagged one')
assert(grammarMastery.correctCount === 2, 'grammar dimension correctly counts 2/3 correct')
assert(grammarMastery.accuracyPct === Math.round((2 / 3) * 1000) / 10, 'accuracy is exactly correctCount/totalCount, recomputable by hand')
assert(!dimMastery.some((m) => m.key === 'null'), 'untagged (null-dimension) events never appear as a fake "null" dimension bucket')
assert(dimensionEvents.filter((e) => !e.dimension).length === 1, 'sanity: exactly one event in the fixture is untagged')

console.log('\n== Mastery by concept: multi-tag events count toward every tag ==')
const conceptEvents: LearningEvent[] = [
  event({ conceptTags: ['திணை', 'எண்'], isCorrect: true }),
  event({ conceptTags: ['திணை'], isCorrect: false }),
]
const conceptMastery = masteryByConcept(conceptEvents)
const thinaiMastery = conceptMastery.find((m) => m.key === 'திணை')!
const yenMastery = conceptMastery.find((m) => m.key === 'எண்')!
assert(thinaiMastery.totalCount === 2, 'a question tagged with 2 concepts contributes to BOTH concepts\' totals')
assert(yenMastery.totalCount === 1, 'எண் only gets the one event that was actually tagged with it')

console.log('\n== Improvement over time ==')
assert(improvementOverTime([event()]) === null, 'a single data point never produces a misleading improvement comparison')
const improving: LearningEvent[] = [
  event({ isCorrect: false, answeredAt: '2026-01-01T00:00:00Z' }),
  event({ isCorrect: false, answeredAt: '2026-01-02T00:00:00Z' }),
  event({ isCorrect: true, answeredAt: '2026-01-10T00:00:00Z' }),
  event({ isCorrect: true, answeredAt: '2026-01-11T00:00:00Z' }),
]
const improvement = improvementOverTime(improving)!
assert(improvement.earlierAccuracyPct === 0, 'the earlier half\'s accuracy reflects only early events')
assert(improvement.laterAccuracyPct === 100, 'the later half\'s accuracy reflects only later events')
assert(improvement.deltaPct === 100, 'improvement delta is exactly later minus earlier')
const shuffled = [...improving].reverse()
const improvementFromShuffled = improvementOverTime(shuffled)!
assert(improvementFromShuffled.deltaPct === improvement.deltaPct, 'improvement is computed by TIME order, not input array order')

console.log('\n== Students needing practice: threshold + minimum attempts, never a single-mistake flag ==')
const practiceEvents: LearningEvent[] = [
  event({ studentId: 'weak-1', conceptTags: ['ண/ந/ன'], isCorrect: false }),
  event({ studentId: 'weak-1', conceptTags: ['ண/ந/ன'], isCorrect: false }),
  event({ studentId: 'weak-1', conceptTags: ['ண/ந/ன'], isCorrect: true }),
  event({ studentId: 'strong-1', conceptTags: ['ண/ந/ன'], isCorrect: true }),
  event({ studentId: 'strong-1', conceptTags: ['ண/ந/ன'], isCorrect: true }),
  event({ studentId: 'strong-1', conceptTags: ['ண/ந/ன'], isCorrect: true }),
  event({ studentId: 'too-few-1', conceptTags: ['ண/ந/ன'], isCorrect: false }), // only 1 attempt
]
const needingPractice = studentsNeedingPracticeForConcept(practiceEvents, 'ண/ந/ன')
assert(needingPractice.some((s) => s.studentId === 'weak-1'), 'a student with 1/3 correct (33%) on a concept is flagged as needing practice')
assert(!needingPractice.some((s) => s.studentId === 'strong-1'), 'a student with 3/3 correct is never flagged')
assert(!needingPractice.some((s) => s.studentId === 'too-few-1'), 'a student with only 1 attempt is never flagged -- not enough data to judge fairly')
assert(needingPractice[0]?.studentId === 'weak-1', 'results are sorted weakest-accuracy-first')

const attention = conceptsNeedingAttention(practiceEvents)
assert(attention.some((a) => a.concept === 'ண/ந/ன'), 'a concept with at least one struggling student appears in conceptsNeedingAttention')
assert(attention.find((a) => a.concept === 'ண/ந/ன')?.studentsNeedingPractice.length === 1, 'exactly the one qualifying student is listed for this concept')

console.log('\n== Confusion pairs: only for single-answer types, only on wrong answers ==')
assert(extractConfusionPair('MULTIPLE_CHOICE', { correctAnswer: 'ண' }, 'ந', false)?.submittedValue === 'ந', 'a wrong MULTIPLE_CHOICE answer extracts the confused value')
assert(extractConfusionPair('MULTIPLE_CHOICE', { correctAnswer: 'ண' }, 'ண', true) === null, 'a CORRECT answer never produces a confusion pair')
assert(extractConfusionPair('TEXT_INPUT', { acceptedAnswers: ['a'] }, 'b', false) === null, 'an open-ended type (TEXT_INPUT) never produces a confusion pair -- not a single meaningful mistake')
assert(extractConfusionPair('TRUE_FALSE', { correctAnswer: true }, false, false)?.submittedValue === 'false', 'TRUE_FALSE confusion pairs stringify booleans consistently')
assert(extractConfusionPair('MULTIPLE_CHOICE', { correctAnswer: 'ண' }, null, false) === null, 'a null/timeout submission never produces a confusion pair (nothing to blame)')
assert(confusionPairKey('ண', 'ந') === confusionPairKey('ந', 'ண'), 'a confusion pair key is order-independent -- mixing up A for B is the same confusion as B for A')

console.log('\n== Common mistakes: the flagship "7 students confused ண/ந/ன" scenario ==')
const confusionEvents = Array.from({ length: 7 }, (_, i) => ({ studentId: `student-${i}`, confusionPairKey: confusionPairKey('ண', 'ந') }))
confusionEvents.push({ studentId: 'lone-student', confusionPairKey: confusionPairKey('க', 'ங') })
const mistakes = commonMistakes(confusionEvents)
const flagship = mistakes.find((m) => m.pairKey === confusionPairKey('ண', 'ந'))
assert(Boolean(flagship), 'a confusion shared by 7 distinct students is detected as a common mistake')
assert(flagship?.studentIds.length === 7, 'exactly 7 distinct students are attributed to the ண/ந confusion')
assert(!mistakes.some((m) => m.pairKey === confusionPairKey('க', 'ங')), 'a confusion made by only 1 student never counts as a class-wide common mistake')
const repeatedSameStudent = [
  { studentId: 'a', confusionPairKey: confusionPairKey('ண', 'ந') },
  { studentId: 'a', confusionPairKey: confusionPairKey('ண', 'ந') },
  { studentId: 'a', confusionPairKey: confusionPairKey('ண', 'ந') },
]
assert(commonMistakes(repeatedSameStudent).length === 0, 'the SAME student making the same mistake repeatedly never counts as multiple students -- distinct student count is what matters')

console.log('\n== Student challenge (இன்றைய சவால்): constructive framing only ==')
const challengeEvents: LearningEvent[] = [
  event({ conceptTags: ['மயங்கொலி'], isCorrect: false }),
  event({ conceptTags: ['மயங்கொலி'], isCorrect: false }),
  event({ conceptTags: ['திணை'], isCorrect: true }),
  event({ conceptTags: ['திணை'], isCorrect: true }),
]
const picked = pickChallengeConcepts(challengeEvents)
assert(picked.some((c) => c.concept === 'மயங்கொலி'), 'a concept with low accuracy and enough attempts is picked for the daily challenge')
assert(!picked.some((c) => c.concept === 'திணை'), 'a concept the student is already doing well on is NOT picked')
assert(pickChallengeConcepts([event({ conceptTags: ['x'], isCorrect: false })]).length === 0, 'a concept with too few attempts (1) is never picked -- not enough data')
const message = challengeMessage(picked)
assert(!/bad|weak|fail|poor|wrong/i.test(message), 'the challenge message never uses discouraging language')
assert(/practice|explore|building|challenge/i.test(message), 'the challenge message uses constructive, inviting language')
const emptyMessage = challengeMessage([])
assert(!/bad|weak|fail|poor|wrong/i.test(emptyMessage), 'even the no-data fallback message is constructive, never discouraging')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
