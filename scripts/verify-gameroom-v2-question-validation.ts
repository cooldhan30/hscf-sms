// Standalone verification script for the Question Set Builder's
// validation layer (lib/gameRoomV2/domain/validateQuestion.ts) and
// compatibility calculator (compatibility.ts). Same tsx-script
// convention as the other verify-gameroom-v2-*.ts scripts (this repo
// has no formal test framework).
//
// Run with: npx tsx scripts/verify-gameroom-v2-question-validation.ts

import { validateQuestionPayload, validateQuestionSet } from '../lib/gameRoomV2/domain/validateQuestion'
import { checkEngineCompatibility } from '../lib/gameRoomV2/domain/compatibility'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

function isValid(type: Parameters<typeof validateQuestionPayload>[0], prompt: string, payload: unknown): boolean {
  return validateQuestionPayload(type, prompt, payload).length === 0
}

console.log('== Blank question cannot save ==')
assert(!isValid('MULTIPLE_CHOICE', '', { options: ['a', 'b'], correctAnswer: 'a' }), 'blank prompt text rejected')
assert(!isValid('MULTIPLE_CHOICE', '   ', { options: ['a', 'b'], correctAnswer: 'a' }), 'whitespace-only prompt rejected')
assert(validateQuestionSet([]).length > 0, 'an empty question set is rejected')
assert(
  validateQuestionSet([{ questionType: 'MULTIPLE_CHOICE', prompt: 'Q1?', payload: { options: ['a', 'b'], correctAnswer: 'a' } }]).length === 0,
  'a set with one valid question passes'
)

console.log('\n== Multiple choice requires valid choices and answer ==')
assert(!isValid('MULTIPLE_CHOICE', 'Q?', { options: ['a'], correctAnswer: 'a' }), 'rejects fewer than 2 options')
assert(!isValid('MULTIPLE_CHOICE', 'Q?', { options: ['a', 'a'], correctAnswer: 'a' }), 'rejects duplicate options')
assert(!isValid('MULTIPLE_CHOICE', 'Q?', { options: ['a', 'b'], correctAnswer: '' }), 'rejects missing correct answer')
assert(!isValid('MULTIPLE_CHOICE', 'Q?', { options: ['a', 'b'], correctAnswer: 'c' }), 'rejects correct answer not among options')
assert(isValid('MULTIPLE_CHOICE', 'Q?', { options: ['a', 'b'], correctAnswer: 'a' }), 'accepts a well-formed multiple choice question')

console.log('\n== True/False requires a boolean answer ==')
assert(!isValid('TRUE_FALSE', 'Q?', { correctAnswer: null }), 'rejects missing answer')
assert(!isValid('TRUE_FALSE', 'Q?', { correctAnswer: 'true' }), 'rejects a string instead of a real boolean')
assert(isValid('TRUE_FALSE', 'Q?', { correctAnswer: true }), 'accepts a real boolean answer')
assert(isValid('TRUE_FALSE', 'Q?', { correctAnswer: false }), 'accepts false as a valid (not falsy/missing) answer')

console.log('\n== Ordering requires ordered components ==')
assert(
  !isValid('ORDER_WORDS', 'Q?', { words: ['a', 'b'], correctOrder: [] }),
  'rejects an empty correct order'
)
assert(
  !isValid('ORDER_WORDS', 'Q?', { words: ['a', 'b'], correctOrder: ['a'] }),
  'rejects a correct order missing an item'
)
assert(
  !isValid('ORDER_WORDS', 'Q?', { words: ['a', 'b'], correctOrder: ['a', 'c'] }),
  'rejects a correct order referencing an item not in the word list'
)
assert(
  isValid('ORDER_WORDS', 'Q?', { words: ['a', 'b'], correctOrder: ['b', 'a'] }),
  'accepts a correct order that is a valid permutation of the words'
)
assert(
  isValid('ORDER_LETTERS', 'Q?', { letters: ['அ', 'ஆ'], correctOrder: ['ஆ', 'அ'] }),
  'accepts a valid Tamil letter ordering'
)

console.log('\n== Categorization requires valid categories ==')
assert(
  !isValid('CATEGORIZE', 'Q?', { items: ['a', 'b'], categories: ['x', 'y'], answerKey: { a: 'x' } }),
  'rejects a missing item-to-category assignment'
)
assert(
  !isValid('CATEGORIZE', 'Q?', { items: ['a', 'b'], categories: ['x', 'y'], answerKey: { a: 'x', b: 'z' } }),
  'rejects an assignment to a category that was not declared'
)
assert(
  isValid('CATEGORIZE', 'Q?', { items: ['a', 'b'], categories: ['x', 'y'], answerKey: { a: 'x', b: 'y' } }),
  'accepts a fully and correctly assigned categorize question'
)

console.log('\n== Fill in the blank requires matching markers and answers ==')
assert(!isValid('FILL_BLANK', 'The sky is blue.', { blanks: [] }), 'rejects a prompt with no ___ marker')
assert(!isValid('FILL_BLANK', 'The sky is ___.', { blanks: [] }), 'rejects a marker with no answer set')
assert(!isValid('FILL_BLANK', 'The sky is ___.', { blanks: [[]] }), 'rejects a blank with zero accepted answers')
assert(isValid('FILL_BLANK', 'The sky is ___.', { blanks: [['blue']] }), 'accepts a matching marker + answer')
assert(
  !isValid('FILL_BLANK', 'The ___ is ___.', { blanks: [['sky']] }),
  'rejects when marker count and answer-set count disagree'
)

console.log('\n== Match requires at least 2 complete pairs ==')
assert(!isValid('MATCH', 'Q?', { pairs: [{ left: 'a', right: 'b' }] }), 'rejects fewer than 2 pairs')
assert(!isValid('MATCH', 'Q?', { pairs: [{ left: 'a', right: '' }, { left: 'c', right: 'd' }] }), 'rejects an incomplete pair')
assert(isValid('MATCH', 'Q?', { pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] }), 'accepts 2 complete pairs')

console.log('\n== Text input requires at least one accepted answer ==')
assert(!isValid('TEXT_INPUT', 'Q?', { acceptedAnswers: [] }), 'rejects zero accepted answers')
assert(!isValid('TEXT_INPUT', 'Q?', { acceptedAnswers: ['  '] }), 'rejects whitespace-only answers')
assert(isValid('TEXT_INPUT', 'Q?', { acceptedAnswers: ['தமிழ்'] }), 'accepts a Tamil accepted answer, unmodified')

console.log('\n== Image/Audio choice basics ==')
assert(!isValid('IMAGE_CHOICE', 'Q?', { options: [{ imageUrl: 'a.png' }], correctAnswer: 'a.png' }), 'rejects fewer than 2 image options')
assert(
  isValid('IMAGE_CHOICE', 'Q?', { options: [{ imageUrl: 'a.png' }, { imageUrl: 'b.png' }], correctAnswer: 'a.png' }),
  'accepts a well-formed image choice question'
)
assert(!isValid('AUDIO_CHOICE', 'Q?', { audioUrl: '', options: ['a', 'b'], correctAnswer: 'a' }), 'rejects a missing audio clip')
assert(
  isValid('AUDIO_CHOICE', 'Q?', { audioUrl: 'clip.mp3', options: ['a', 'b'], correctAnswer: 'a' }),
  'accepts a well-formed audio choice question'
)

console.log('\n== PLAYABLE GAMES calculation explains incompatibility ==')
const results = checkEngineCompatibility(GAME_ENGINES_V2, ['MULTIPLE_CHOICE'])
const classicQuiz = results.find((r) => r.engine.id === 'classic-quiz')
const matching = results.find((r) => r.engine.id === 'matching')
assert(classicQuiz?.compatible === true, 'Classic Quiz is compatible with a MULTIPLE_CHOICE-only set')
assert(matching?.compatible === false, 'the Matching activity is NOT compatible with a MULTIPLE_CHOICE-only set')
assert(
  (matching?.unsupportedTypes.length ?? 0) > 0 && Boolean(matching?.unsupportedTypes.includes('MULTIPLE_CHOICE')),
  'an incompatible engine reports which question type(s) it cannot support, for display'
)

const matchResults = checkEngineCompatibility(GAME_ENGINES_V2, ['MATCH', 'PRONUNCIATION'])
assert(
  matchResults.every((r) => !r.compatible),
  'a set containing an unimplemented type (PRONUNCIATION) is compatible with zero engines'
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
