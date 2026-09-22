// Standalone verification script for the GameRoom V2 gameplay
// framework: server-side grading (gradeAnswer.ts), scoring/reward math
// (scoring.ts), the shuffle utilities (shuffle.ts), and the skill-
// extraction helper (skillsForQuestionSet.ts). Same tsx-script
// convention as every other verify-gameroom-v2-*.ts script (no formal
// test framework exists in this repo).
//
// Run with: npx tsx scripts/verify-gameroom-v2-gameplay.ts

import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'
import { calculatePoints, calculateRewardsForAnswer, calculateCompletionBonus } from '../lib/gameRoomV2/scoring'
import { shuffle, shuffledOptionsFor } from '../lib/gameRoomV2/shuffle'
import { skillsForQuestionSet } from '../lib/gameRoomV2/skillsForQuestionSet'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== gradeAnswer: never trusts client-claimed correctness, always re-derives it ==')
assert(gradeAnswer('MULTIPLE_CHOICE', { options: ['a', 'b'], correctAnswer: 'a' }, 'a') === true, 'MULTIPLE_CHOICE: correct option graded correct')
assert(gradeAnswer('MULTIPLE_CHOICE', { options: ['a', 'b'], correctAnswer: 'a' }, 'b') === false, 'MULTIPLE_CHOICE: wrong option graded incorrect')
assert(gradeAnswer('MULTIPLE_CHOICE', { options: ['a', 'b'], correctAnswer: 'a' }, null) === false, 'MULTIPLE_CHOICE: null (timeout) graded incorrect, never throws')

assert(gradeAnswer('TRUE_FALSE', { correctAnswer: true }, true) === true, 'TRUE_FALSE: matching boolean graded correct')
assert(gradeAnswer('TRUE_FALSE', { correctAnswer: true }, false) === false, 'TRUE_FALSE: mismatched boolean graded incorrect')
assert(gradeAnswer('TRUE_FALSE', { correctAnswer: true }, 'true') === false, 'TRUE_FALSE: a string "true" is NOT the same as boolean true -- rejects type confusion')

assert(
  gradeAnswer('TEXT_INPUT', { acceptedAnswers: ['Thinai'] }, '  thinai  ') === true,
  'TEXT_INPUT: case/whitespace-insensitive match accepted'
)
assert(gradeAnswer('TEXT_INPUT', { acceptedAnswers: ['Thinai'] }, 'Paal') === false, 'TEXT_INPUT: non-matching answer rejected')
assert(
  gradeAnswer('TEXT_INPUT', { acceptedAnswers: ['தமிழ்'] }, 'தமிழ்') === true,
  'TEXT_INPUT: Tamil text compared and accepted unmodified, no transliteration'
)

assert(
  gradeAnswer('FILL_BLANK', { blanks: [['blue'], ['sky']] }, ['Blue', 'SKY']) === true,
  'FILL_BLANK: every blank matched (case-insensitive) graded correct'
)
assert(
  gradeAnswer('FILL_BLANK', { blanks: [['blue'], ['sky']] }, ['blue']) === false,
  'FILL_BLANK: fewer submitted answers than blanks graded incorrect, not a partial match'
)

assert(
  gradeAnswer('MATCH', { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] }, { a: '1', b: '2' }) === true,
  'MATCH: every pair matched correctly graded correct'
)
assert(
  gradeAnswer('MATCH', { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] }, { a: '1', b: '1' }) === false,
  'MATCH: one pair swapped graded incorrect, not partially correct'
)

assert(
  gradeAnswer('ORDER_WORDS', { correctOrder: ['a', 'b', 'c'] }, ['a', 'b', 'c']) === true,
  'ORDER_WORDS: exact matching order graded correct'
)
assert(
  gradeAnswer('ORDER_WORDS', { correctOrder: ['a', 'b', 'c'] }, ['a', 'c', 'b']) === false,
  'ORDER_WORDS: swapped order graded incorrect'
)
assert(
  gradeAnswer('ORDER_LETTERS', { correctOrder: ['அ', 'ஆ'] }, ['அ', 'ஆ']) === true,
  'ORDER_LETTERS: Tamil letters in correct order graded correct'
)

assert(
  gradeAnswer('CATEGORIZE', { items: ['a', 'b'], answerKey: { a: 'x', b: 'y' } }, { a: 'x', b: 'y' }) === true,
  'CATEGORIZE: every item assigned correctly graded correct'
)
assert(
  gradeAnswer('CATEGORIZE', { items: ['a', 'b'], answerKey: { a: 'x', b: 'y' } }, { a: 'x', b: 'x' }) === false,
  'CATEGORIZE: one item misassigned graded incorrect'
)

assert(gradeAnswer('IMAGE_CHOICE', { options: [{ imageUrl: 'a.png' }], correctAnswer: 'a.png' }, 'a.png') === true, 'IMAGE_CHOICE: correct image graded correct')
assert(gradeAnswer('AUDIO_CHOICE', { options: ['a', 'b'], correctAnswer: 'a' }, 'a') === true, 'AUDIO_CHOICE: correct answer graded correct')

assert(gradeAnswer('PRONUNCIATION', {}, 'anything') === false, 'an unimplemented question type never grades as correct, even with a payload')

console.log('\n== calculatePoints: never awards points for an incorrect answer ==')
assert(calculatePoints(false, 500, 20) === 0, 'incorrect answer always scores 0, regardless of response time')
assert(calculatePoints(true, 0, 20) === 1500, 'instant correct answer gets the full base + max speed bonus (1000 + 500)')
assert(calculatePoints(true, 20000, 20) === 1000, 'a correct answer using the FULL time limit gets base points with zero speed bonus')
assert(calculatePoints(true, 10000, 20) === 1250, 'a correct answer at exactly half the time limit gets half the speed bonus')

console.log('\n== calculateRewardsForAnswer: streak bonus, capped, and only for correct answers ==')
assert(JSON.stringify(calculateRewardsForAnswer(false, 5)) === JSON.stringify({ xp: 0, coins: 0 }), 'an incorrect answer earns zero XP/coins regardless of streak')
assert(calculateRewardsForAnswer(true, 0).xp === 10, 'a correct answer with no streak earns the base XP amount')
assert(calculateRewardsForAnswer(true, 5).xp > calculateRewardsForAnswer(true, 0).xp, 'a higher streak earns more XP than no streak')
assert(
  calculateRewardsForAnswer(true, 50).xp === calculateRewardsForAnswer(true, 10).xp,
  'the streak bonus is capped -- a streak of 50 earns no more XP than the cap (10)'
)
assert(calculateRewardsForAnswer(true, 0).coins === 2, 'a correct answer earns a fixed coin amount, independent of streak')

console.log('\n== calculateCompletionBonus: a flat, deterministic bonus ==')
const bonus1 = calculateCompletionBonus()
const bonus2 = calculateCompletionBonus()
assert(bonus1.xp > 0 && bonus1.coins > 0, 'the completion bonus is a positive, non-zero reward')
assert(JSON.stringify(bonus1) === JSON.stringify(bonus2), 'the completion bonus is deterministic, not randomized -- calling it twice gives the same result')

console.log('\n== shuffle / shuffledOptionsFor ==')
const original = ['a', 'b', 'c', 'd', 'e']
const shuffled = shuffle(original)
assert(shuffled.length === original.length, 'shuffle() preserves the item count')
assert([...shuffled].sort().join('') === [...original].sort().join(''), 'shuffle() is a permutation -- same items, just reordered')
assert(original.join('') === 'abcde', 'shuffle() does not mutate the original array')

const seeded1 = shuffledOptionsFor(original, 'session-1:question-1')
const seeded2 = shuffledOptionsFor(original, 'session-1:question-1')
const seededDifferentSeed = shuffledOptionsFor(original, 'session-2:question-1')
assert(seeded1.join('') === seeded2.join(''), 'shuffledOptionsFor() returns the SAME order for the same seed -- stable across repeated polls')
assert(
  seeded1.join('') !== seededDifferentSeed.join('') || original.length < 3,
  'shuffledOptionsFor() returns a different order for a different seed (session/question pair)'
)

console.log('\n== skillsForQuestionSet: architecture for mastery analytics ==')
assert(
  JSON.stringify(skillsForQuestionSet({ subject: 'Grammar', topic: 'Thinai', tags: ['beginner'] }).sort()) ===
    JSON.stringify(['Grammar', 'Thinai', 'beginner'].sort()),
  'subject + topic + tags are all captured as skills'
)
assert(skillsForQuestionSet({ subject: null, topic: null, tags: [] }).length === 0, 'a set with no metadata yields no skills, not a fabricated placeholder')
assert(
  skillsForQuestionSet({ subject: 'Grammar', topic: 'Grammar', tags: ['Grammar'] }).length === 1,
  'duplicate values across subject/topic/tags are deduplicated into one skill'
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
