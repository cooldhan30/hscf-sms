import type { MayangoliWord } from './wordEntry'
import type { MayangoliQuestion, MayangoliQuestionType } from './questionTypes'
import { displayForm } from './groups'
import { shuffledOptionsFor } from '@/lib/gameRoom/shuffle'

// All distractor building blocks below reuse `word.distractors`' exact
// grapheme shape (see wordEntry.ts's validation), so every generated
// option is itself a real, well-formed Tamil grapheme cluster -- never
// a raw bare-letter substitution spliced into a vowel-sign position.

function substituteLetterAt(word: MayangoliWord, replacement: string): string {
  return word.clusters.map((c, i) => (i === word.targetIndex ? replacement : c)).join('')
}

// A stable seed for this exact question instance -- same
// (sessionId, questionIndex) always yields the same option order/pick,
// so every connected player/reconnect sees an identical shared
// question, per Mayangoli's synchronized (not self-paced/per-player)
// model.
function seedFor(sessionId: string, questionIndex: number, salt: string): string {
  return `${sessionId}:${questionIndex}:${salt}`
}

// Deterministically picks one index in [0, length) from a seed, reusing
// shuffledOptionsFor's own seeded PRNG rather than a second ad-hoc hash
// -- the first element of a seeded shuffle of index positions is itself
// a stable, uniformly distributed pick.
function seededIndex(length: number, seed: string): number {
  return shuffledOptionsFor(
    Array.from({ length }, (_, i) => i),
    seed
  )[0]
}

function genFillMissingLetter(word: MayangoliWord, sessionId: string, questionIndex: number): MayangoliQuestion {
  const correctAnswer = displayForm(word.targetLetter)
  const optionLetters = shuffledOptionsFor(
    [word.targetLetter, ...word.distractorBaseLetters],
    seedFor(sessionId, questionIndex, 'fill_missing_letter')
  )
  return {
    questionType: 'fill_missing_letter',
    wordId: word.id,
    targetLetter: word.targetLetter,
    groupId: word.groupId,
    prompt: word.maskedWord,
    options: optionLetters.map(displayForm),
    correctAnswer,
    supportingText: word.meaningEnglish,
  }
}

function genChooseCorrectSpelling(word: MayangoliWord, sessionId: string, questionIndex: number): MayangoliQuestion {
  const wrongSpellings = word.distractors.map((d) => substituteLetterAt(word, d))
  const options = shuffledOptionsFor(
    [word.word, ...wrongSpellings],
    seedFor(sessionId, questionIndex, 'choose_correct_spelling')
  )
  return {
    questionType: 'choose_correct_spelling',
    wordId: word.id,
    targetLetter: word.targetLetter,
    groupId: word.groupId,
    prompt: word.meaningEnglish,
    options,
    correctAnswer: word.word,
  }
}

function genMeaningChallenge(
  word: MayangoliWord,
  allWords: MayangoliWord[],
  sessionId: string,
  questionIndex: number
): MayangoliQuestion {
  // Wrong-meaning options are pulled from other words in the same
  // Mayangoli group so they're plausible confusions, not random noise.
  const pool = allWords.filter(
    (w) => w.groupId === word.groupId && w.id !== word.id && w.meaningEnglish !== word.meaningEnglish
  )
  const distractorMeanings = shuffledOptionsFor(pool, seedFor(sessionId, questionIndex, 'meaning_pool'))
    .slice(0, 3)
    .map((w) => w.meaningEnglish)
  const options = shuffledOptionsFor(
    [word.meaningEnglish, ...distractorMeanings],
    seedFor(sessionId, questionIndex, 'meaning_challenge')
  )
  return {
    questionType: 'meaning_challenge',
    wordId: word.id,
    targetLetter: word.targetLetter,
    groupId: word.groupId,
    prompt: word.word,
    options,
    correctAnswer: word.meaningEnglish,
  }
}

function genFindWrongSpelling(
  word: MayangoliWord,
  allWords: MayangoliWord[],
  sessionId: string,
  questionIndex: number
): MayangoliQuestion {
  // One misspelled version of `word` is mixed in among several OTHER
  // correctly-spelled group words (not the same word repeated -- a
  // student can't "find the wrong spelling" among duplicate strings).
  const wrongPickIndex = seededIndex(word.distractors.length, seedFor(sessionId, questionIndex, 'wrong_index'))
  const wrongSpelling = substituteLetterAt(word, word.distractors[wrongPickIndex])

  const correctFillerPool = allWords.filter((w) => w.groupId === word.groupId && w.id !== word.id)
  const correctFillers = shuffledOptionsFor(correctFillerPool, seedFor(sessionId, questionIndex, 'wrong_spelling_fillers'))
    .slice(0, 3)
    .map((w) => w.word)

  const options = shuffledOptionsFor([wrongSpelling, ...correctFillers], seedFor(sessionId, questionIndex, 'find_wrong_spelling'))
  return {
    questionType: 'find_wrong_spelling',
    wordId: word.id,
    targetLetter: word.targetLetter,
    groupId: word.groupId,
    prompt: 'Find the misspelled word',
    options,
    correctAnswer: wrongSpelling,
  }
}

export function generateMayangoliQuestion(
  word: MayangoliWord,
  allWords: MayangoliWord[],
  questionType: MayangoliQuestionType,
  sessionId: string,
  questionIndex: number
): MayangoliQuestion {
  switch (questionType) {
    case 'fill_missing_letter':
      return genFillMissingLetter(word, sessionId, questionIndex)
    case 'choose_correct_spelling':
      return genChooseCorrectSpelling(word, sessionId, questionIndex)
    case 'meaning_challenge':
      return genMeaningChallenge(word, allWords, sessionId, questionIndex)
    case 'find_wrong_spelling':
      return genFindWrongSpelling(word, allWords, sessionId, questionIndex)
  }
}
