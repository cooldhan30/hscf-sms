// GameRoom Classic Phase 2: question validation, CSV import and game rules.
// Run with: npx tsx scripts/verify-grc-library.ts
import { MAX_IMPORT_ROWS, TEMPLATES, parseCsv, readImport, templateCsv } from '../lib/grClassic/csv'
import { planImport } from '../lib/grClassic/importPlan'
import { validateGame } from '../lib/grClassic/validateGame'
import { validateQuestion, type ValidQuestion } from '../lib/grClassic/validateQuestion'
import type { Category, QuestionKind } from '../lib/grClassic/types'

let failures = 0
let passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++
  else {
    failures++
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`)
  }
}
const ok = (input: Parameters<typeof validateQuestion>[0]): ValidQuestion => {
  const v = validateQuestion(input)
  if (!v.ok) throw new Error(`expected valid: ${v.errors.join(' ')}`)
  return v.value
}
const errs = (input: Parameters<typeof validateQuestion>[0]) => {
  const v = validateQuestion(input)
  return v.ok ? [] : v.errors
}

// --- 1. Quiz questions ---
const q = ok({ kind: 'choice', prompt: '  தமிழில்   எத்தனை உயிர் எழுத்துக்கள்? ', options: ['10', '', '12', ''], answerIndex: 2 })
eq('choice trims and collapses spaces', q.prompt, 'தமிழில் எத்தனை உயிர் எழுத்துக்கள்?')
eq('choice drops blank answers, keeps the right one', q.payload, { options: ['10', '12'], answerIndex: 1 })
eq('choice default difficulty', q.difficulty, 'easy')
eq('choice needs a question', errs({ kind: 'choice', prompt: '', options: ['a', 'b'], answerIndex: 0 }), ['Write the question.'])
eq('choice needs two answers', errs({ kind: 'choice', prompt: 'x', options: ['a'], answerIndex: 0 }), ['Give at least two answers.'])
eq('choice at most four', errs({ kind: 'choice', prompt: 'x', options: ['a', 'b', 'c', 'd', 'e'], answerIndex: 0 }), ['Give at most four answers.'])
eq('choice same answers', errs({ kind: 'choice', prompt: 'x', options: ['அ', 'அ'], answerIndex: 0 }), ['Two answers are the same.'])
eq('choice right answer must be filled', errs({ kind: 'choice', prompt: 'x', options: ['a', 'b', ''], answerIndex: 2 }), ['Mark which answer is right.'])
eq('choice bad type', errs({ kind: 'essay' }), ['Question type must be quiz, matching or word builder.'])
eq('choice bad topic id', errs({ kind: 'choice', prompt: 'x', options: ['a', 'b'], answerIndex: 0, categoryId: 'not-a-uuid' }), ['Topic is not valid.'])

// Duplicate fingerprint ignores spacing, letter case and answer order, but not the right answer.
const k1 = ok({ kind: 'choice', prompt: 'Which is long?', options: ['அ', 'ஆ'], answerIndex: 1 }).contentKey
eq('same question, reordered answers', ok({ kind: 'choice', prompt: ' which  is LONG? ', options: ['ஆ', 'அ'], answerIndex: 0 }).contentKey, k1)
eq('different right answer is a different question', ok({ kind: 'choice', prompt: 'Which is long?', options: ['அ', 'ஆ'], answerIndex: 0 }).contentKey === k1, false)

// Tamil typed in decomposed form is stored composed (NFC).
const decomposed = 'க' + String.fromCharCode(0x0bc6, 0x0bbe) + 'டி' // கொடி with ொ as ெ + ா
eq('NFC normalisation', (ok({ kind: 'order', answer: decomposed }).payload as { answer: string }).answer, 'கொடி')
eq('decomposed and composed are duplicates', ok({ kind: 'order', answer: decomposed }).contentKey, ok({ kind: 'order', answer: 'கொடி' }).contentKey)

// --- 2. Matching ---
const m = ok({ kind: 'match', pairs: [{ left: 'பூனை', right: 'cat' }, { left: 'நாய்', right: 'dog' }, { left: '', right: '' }] })
eq('match drops empty rows, default instruction', [m.prompt, (m.payload as { pairs: unknown[] }).pairs.length], ['பொருத்துக', 2])
eq('match one-sided pair', errs({ kind: 'match', pairs: [{ left: 'a', right: '' }, { left: 'b', right: 'c' }, { left: 'd', right: 'e' }] }), ['Every pair needs both sides filled in.'])
eq('match needs two pairs', errs({ kind: 'match', pairs: [{ left: 'a', right: 'b' }] }), ['Give at least two pairs.'])
eq('match unique partners', errs({ kind: 'match', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'X' }] }), ['Two partners on the right are the same.'])
eq('match pair order does not matter for duplicates', ok({ kind: 'match', pairs: [{ left: 'b', right: 'y' }, { left: 'a', right: 'x' }] }).contentKey, ok({ kind: 'match', prompt: 'other words', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'y' }] }).contentKey)

// --- 3. Word Builder ---
const w = ok({ kind: 'order', answer: 'அம்மா', promptEn: 'mother' })
eq('order letters + default prompt', [w.payload, w.prompt], [{ unit: 'letters', answer: 'அம்மா' }, 'எழுத்துக்களை அடுக்கிச் சொல்லை அமை'])
eq('order sentence detected', (ok({ kind: 'order', answer: 'நான் பள்ளிக்குச் செல்கிறேன்' }).payload as { unit: string }).unit, 'words')
eq('order needs two letters', errs({ kind: 'order', answer: 'கா' }), ['The word needs at least two letters.'])
eq('order needs an answer', errs({ kind: 'order', answer: '  ' }), ['Type the word or sentence.'])
eq('order too many words', errs({ kind: 'order', answer: Array(13).fill('அ').join(' ') }), ['A sentence can have at most 12 words.'])

// --- 4. CSV parsing ---
eq('quoted comma, escaped quote, newline', parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n'), [['a', 'b'], ['x, y', 'say "hi"\nthere']])
eq('BOM stripped, blank lines dropped', parseCsv('\uFEFFh1,h2\n\n1,2\n\n'), [['h1', 'h2'], ['1', '2']])
eq('tab-separated paste', parseCsv('topic\tquestion\nஅ\tஆ'), [['topic', 'question'], ['அ', 'ஆ']])

// --- 5. Every template imports cleanly ---
const cats: Category[] = [{ id: 'c1', name: 'உயிர் எழுத்துக்கள்', own: false }]
for (const kind of Object.keys(TEMPLATES) as QuestionKind[]) {
  const parsed = readImport(templateCsv(kind))
  eq(`template ${kind} detected`, parsed.ok && parsed.kind, kind)
  if (parsed.ok) {
    const plan = planImport(parsed.rows, new Set(), cats, (k) => k)
    eq(`template ${kind} rows all ok`, plan.map((r) => r.status), TEMPLATES[kind].examples.map(() => 'ok'))
    eq(`template ${kind} keeps Tamil`, plan[0].summary.length > 0 && /[஀-௿]/.test(plan[0].summary), true)
  }
}

// --- 6. Import rules ---
const quizCsv = [
  'topic,question,question_english,answer_1,answer_2,answer_3,answer_4,correct_answer,explanation,difficulty',
  'உயிர் எழுத்துக்கள்,Q one,,அ,ஆ,,,2,,easy', // ok, existing topic
  'புதிய தலைப்பு,Q two,,க,ங,,,க,,medium', // ok, right answer given as text, new topic
  'உயிர் எழுத்துக்கள்,q  ONE,,ஆ,அ,,,1,,', // same as row 2 -> duplicate in file
  ',Q three,,x,,,,1,,', // one answer -> error
  ',Already have,,a,b,,,1,,', // in library -> duplicate
].join('\n')
const parsed = readImport(quizCsv)
if (!parsed.ok) throw new Error(parsed.error)
const existing = new Set([ok({ kind: 'choice', prompt: 'Already have', options: ['a', 'b'], answerIndex: 0 }).contentKey])
const plan = planImport(parsed.rows, existing, cats, (k) => k)
eq('import statuses', plan.map((r) => r.status), ['ok', 'ok', 'duplicate', 'error', 'duplicate'])
eq('import spreadsheet row numbers', plan.map((r) => r.line), [2, 3, 4, 5, 6])
eq('import topic matched / new', plan.slice(0, 2).map((r) => [r.topic, r.newTopic]), [['உயிர் எழுத்துக்கள்', false], ['புதிய தலைப்பு', true]])
eq('import right answer by text', (plan[1].value!.payload as { answerIndex: number }).answerIndex, 0)
eq('import difficulty', plan[1].value!.difficulty, 'medium')
eq('import duplicate reasons', [plan[2].errors[0], plan[4].errors[0]], ['Same as an earlier row in this file.', 'Already in your library.'])
eq('import error reason', plan[3].errors, ['Give at least two answers.'])
eq('unknown template', readImport('a,b\n1,2'), { ok: false, error: 'This file doesn’t match a template. Download a template, fill it in, and keep its first row as it is.' })
eq('broken encoding detected', readImport('topic,question,answer_1\n\uFFFD,x,y').ok, false)
eq('too many rows', readImport(['topic,word_or_sentence', ...Array(MAX_IMPORT_ROWS + 1).fill('t,அம்மா')].join('\n')).ok, false)
eq('header only', readImport('topic,word_or_sentence\n').ok, false)

// --- 7. Games ---
const id1 = '11111111-1111-4111-8111-111111111111'
const id2 = '22222222-2222-4222-8222-222222222222'
const g = validateGame({ title: ' My game ', type: 'quiz', questionIds: [id1, id2, id1], liveSeconds: 45 })
eq('game ok, duplicates removed, bad seconds -> 20', g.ok && [g.value.title, g.value.questionIds, g.value.liveSeconds], ['My game', [id1, id2], 20])
eq('game needs name and questions', (() => { const v = validateGame({ title: '', type: 'quiz', questionIds: [] }); return v.ok ? [] : v.errors })(), ['Give your game a name.', 'Add at least one question.'])
eq('game bad type and id', (() => { const v = validateGame({ title: 'x', type: 'bingo', questionIds: ['nope'] }); return v.ok ? [] : v.errors })(), ['Choose a game type.', 'Some questions are not valid.', 'Add at least one question.'])

console.log(failures ? `\n${failures} FAILURE(S), ${passes} passed` : `\nPASS: ${passes} checks.`)
process.exit(failures ? 1 : 0)
