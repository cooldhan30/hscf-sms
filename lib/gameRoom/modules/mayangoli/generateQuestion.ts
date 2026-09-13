import type { MayangoliWord } from './wordEntry'
import type { MayangoliQuestion, MayangoliQuestionType } from './questionTypes'
import { shuffledOptionsFor } from '@/lib/gameRoom/shuffle'

// A stable seed for this exact question instance -- same
// (sessionId, questionIndex) always yields the same option order/pick,
// so every connected player/reconnect sees an identical shared
// question, per Mayangoli's synchronized (not self-paced/per-player)
// model.
function seedFor(sessionId: string, questionIndex: number, salt: string): string {
  return `${sessionId}:${questionIndex}:${salt}`
}

function genFillMissingLetter(word: MayangoliWord, sessionId: string, questionIndex: number): MayangoliQuestion {
  // Options are the actual grapheme cluster that fills the blank (e.g.
  // "லை"/"ளை"/"ழை" for மலை's blank "ம__"), not the bare consonant with
  // a pulli (ல்/ள்/ழ்) -- a bare-letter option doesn't visually match
  // what the blank represents whenever the target is fused with a
  // vowel sign rather than closing the syllable on its own. word.word
  // itself is the correct answer's source of truth; word.distractors
  // are already stored in this same grapheme shape (see wordEntry.ts).
  const correctAnswer = word.matchedForm
  const options = shuffledOptionsFor(
    [correctAnswer, ...word.distractors],
    seedFor(sessionId, questionIndex, 'fill_missing_letter')
  )
  return {
    questionType: 'fill_missing_letter',
    wordId: word.id,
    targetLetter: word.targetLetter,
    groupId: word.groupId,
    prompt: word.maskedWord,
    options,
    correctAnswer,
    supportingText: word.meaningEnglish,
  }
}

export function generateMayangoliQuestion(
  word: MayangoliWord,
  questionType: MayangoliQuestionType,
  sessionId: string,
  questionIndex: number
): MayangoliQuestion {
  switch (questionType) {
    case 'fill_missing_letter':
      return genFillMissingLetter(word, sessionId, questionIndex)
  }
}
