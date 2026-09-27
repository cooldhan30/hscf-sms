import { validateQuestionPayload, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { normalizeForComparison } from '@/lib/gameRoomV2/domain/textNormalize'
import { mulberry32, seedFromString } from '@/lib/gameRoomV2/gameplay/rng'

// Teacher question-set import: turns an uploaded .txt or .csv file into
// questions the ordinary Question Set Builder API accepts. Pure and
// framework-free (verified by scripts/verify-gameroom-v2-question-import.ts).
//
// Uploaded files are UNTRUSTED input. Here they are only ever decoded as
// text and split into plain strings: nothing is evaluated, no HTML is
// rendered (React escapes everything it displays), spreadsheet formulas
// are flagged rather than kept, and every size is capped. The server's
// POST /api/gameroom-v2/question-sets then re-validates everything and
// sets ownership itself -- the client never decides who owns the set.

export const IMPORT_LIMITS = {
  maxFileBytes: 512 * 1024,
  maxQuestions: 200, // = QUESTION_SET_LIMITS.maxQuestions
  maxQuestionLength: 1000,
  maxAnswerLength: 300,
  maxExplanationLength: 1500,
  maxWrongAnswers: 5,
} as const

export type ImportFormat = 'txt' | 'csv'

export interface ImportRow {
  // 1-based line in the file where this question starts.
  line: number
  question: string
  answer: string
  explanation: string
  wrongAnswers: string[]
  type: string
  topic: string
  skill: string
}

export interface RowCheck {
  errors: string[]
  warnings: string[]
}

export interface ParseResult {
  format: ImportFormat
  rows: ImportRow[]
  // Problems with the file as a whole (encoding, size, header).
  fileErrors: string[]
  notices: string[]
}

// --- Decoding ------------------------------------------------------------

// Bytes -> text. UTF-8 (the default for Tamil) with or without a BOM;
// UTF-16 when a BOM says so (Excel's "Unicode text"). Anything that is not
// valid text is refused with a plain explanation instead of guessing.
export function decodeImportBytes(bytes: Uint8Array): { text: string } | { error: string } {
  if (bytes.length > IMPORT_LIMITS.maxFileBytes) {
    return { error: `The file is too large (${Math.round(bytes.length / 1024)} KB). The limit is ${IMPORT_LIMITS.maxFileBytes / 1024} KB -- split it into smaller sets.` }
  }
  try {
    let text: string
    if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2))
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2))
    else text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    if (/\u0000/.test(text)) return { error: 'This does not look like a text file. Save it as "Text (.txt)" or "CSV UTF-8 (.csv)" and try again.' }
    return { text: text.normalize('NFC').replace(/\r\n?/g, '\n') }
  } catch {
    return { error: 'This file is not saved as UTF-8 text, so Tamil letters would be garbled. In Excel choose "CSV UTF-8"; in Notepad choose "UTF-8" when saving.' }
  }
}

export function formatForFileName(name: string): ImportFormat | null {
  const lower = name.toLowerCase().trim()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.txt')) return 'txt'
  return null
}

// --- Cleaning -------------------------------------------------------------

// Keeps text as text: drops control characters (not tabs/newlines inside
// multi-line fields) and zero-width junk outside Tamil conjuncts, trims.
function clean(v: string): string {
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[​﻿]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

// --- TXT ------------------------------------------------------------------

const LABELS: { field: keyof ImportRow | 'wrong'; re: RegExp }[] = [
  { field: 'question', re: /^(question|q|கேள்வி|வினா)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'answer', re: /^(answer|ans|a|விடை|பதில்)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'explanation', re: /^(explanation|explain|why|விளக்கம்)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'wrong', re: /^(wrong(\s*answers?)?|choices|options|distractors|தவறான\s*விடைகள்?|தேர்வுகள்)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'topic', re: /^(topic|தலைப்பு)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'skill', re: /^(skill|திறன்)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
  { field: 'type', re: /^(type|வகை)(?:\s*[:：]\s*|\s+[-–]\s+)/i },
]

const splitList = (v: string) =>
  v
    .split(/\s*[|;]\s*/)
    .map((x) => clean(x))
    .filter(Boolean)

function emptyRow(line: number): ImportRow {
  return { line, question: '', answer: '', explanation: '', wrongAnswers: [], type: '', topic: '', skill: '' }
}

// The simple labelled format:
//   Question: ...
//   Answer: ...
//   Explanation: ...      (optional; any number of lines)
// Questions are separated by a blank line or simply by the next
// "Question:". Lines without a label continue the previous field. A line
// "question | answer | explanation" (no labels) is one whole question.
export function parseTxt(text: string): ParseResult {
  const rows: ImportRow[] = []
  const notices: string[] = []
  let cur: ImportRow | null = null
  let lastField: keyof ImportRow | 'wrong' | null = null
  const flush = () => {
    if (cur && (cur.question || cur.answer || cur.explanation)) rows.push(cur)
    cur = null
    lastField = null
  }
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) {
      flush()
      return
    }
    if (/^#/.test(line)) return // comment lines in the template
    const label = LABELS.find((l) => l.re.test(line))
    if (label) {
      const value = line.replace(label.re, '')
      if (label.field === 'question' && cur && (cur as ImportRow).question) flush()
      if (!cur) cur = emptyRow(i + 1)
      const row: ImportRow = cur
      if (label.field === 'wrong') row.wrongAnswers.push(...splitList(value))
      else (row as unknown as Record<string, string>)[label.field] = clean(value)
      lastField = label.field
      return
    }
    if (!cur && line.includes('|')) {
      const [q, a, e] = line.split('|').map((x) => clean(x))
      rows.push({ ...emptyRow(i + 1), question: q ?? '', answer: a ?? '', explanation: e ?? '' })
      return
    }
    if (cur && lastField && lastField !== 'wrong') {
      const row: ImportRow = cur
      const key = lastField as 'question' | 'answer' | 'explanation'
      row[key] = clean(`${row[key]}\n${line}`)
      return
    }
    if (!cur) {
      // An unlabelled line on its own: keep it as a question so the
      // teacher can see and fix it in the preview instead of losing it.
      cur = emptyRow(i + 1)
      cur.question = clean(line)
      lastField = 'question'
    }
  })
  flush()
  if (rows.length === 0) notices.push('No questions were found. Each question needs a line starting with "Question:" and a line starting with "Answer:".')
  return { format: 'txt', rows, fileErrors: [], notices }
}

// --- CSV ------------------------------------------------------------------

// RFC 4180: quoted fields may contain commas, quotes ("") and newlines.
export function splitCsv(text: string, delimiter: string): { cells: string[]; line: number }[] {
  const out: { cells: string[]; line: number }[] = []
  let cells: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }
    if (ch === '"' && field.trim() === '') {
      field = ''
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(field)
      field = ''
    } else if (ch === '\n') {
      cells.push(field)
      out.push({ cells, line: rowLine })
      cells = []
      field = ''
      line++
      rowLine = line
    } else field += ch
  }
  if (field !== '' || cells.length) {
    cells.push(field)
    out.push({ cells, line: rowLine })
  }
  return out.filter((r) => r.cells.some((c) => c.trim() !== ''))
}

const COLUMN_ALIASES: Record<string, string> = {
  question: 'question',
  questions: 'question',
  prompt: 'question',
  கேள்வி: 'question',
  வினா: 'question',
  answer: 'answer',
  correct_answer: 'answer',
  விடை: 'answer',
  பதில்: 'answer',
  explanation: 'explanation',
  why: 'explanation',
  விளக்கம்: 'explanation',
  hint: 'hint',
  difficulty: 'difficulty',
  topic: 'topic',
  skill: 'skill',
  type: 'type',
  wrong_answer_1: 'wrong',
  wrong_answer_2: 'wrong',
  wrong_answer_3: 'wrong',
  wrong_answer_4: 'wrong',
  wrong_answer_5: 'wrong',
}

export function parseCsv(text: string): ParseResult {
  const firstLine = text.split('\n', 1)[0] ?? ''
  const delimiter = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','
  const records = splitCsv(text, delimiter)
  const fileErrors: string[] = []
  const notices: string[] = []
  if (records.length === 0) return { format: 'csv', rows: [], fileErrors: ['The file is empty.'], notices }
  const header = records[0].cells.map((h) =>
    h
      .normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/^﻿/, '')
      .replace(/[\s-]+/g, '_')
  )
  const roles = header.map((h) => COLUMN_ALIASES[h] ?? null)
  if (!roles.includes('question') || !roles.includes('answer')) {
    fileErrors.push('The first row must be a header with at least "question" and "answer" columns (for example: question,answer,explanation).')
    return { format: 'csv', rows: [], fileErrors, notices }
  }
  const unknown = header.filter((h, i) => h && !roles[i])
  if (unknown.length) notices.push(`These columns were ignored: ${unknown.join(', ')}.`)
  if (roles.includes('hint')) notices.push('The "hint" column is not used yet -- hints were left out.')
  if (roles.includes('difficulty')) notices.push('Per-question difficulty is not used -- choose the set difficulty on the next step.')
  const rows: ImportRow[] = records.slice(1).map(({ cells, line }) => {
    const row = emptyRow(line)
    cells.forEach((raw, i) => {
      const role = roles[i]
      const v = clean(raw)
      if (!role || !v) return
      if (role === 'wrong') row.wrongAnswers.push(v)
      else if (role === 'question' || role === 'answer' || role === 'explanation' || role === 'topic' || role === 'skill' || role === 'type') row[role] = v
    })
    return row
  })
  return { format: 'csv', rows, fileErrors, notices }
}

export function parseImport(format: ImportFormat, text: string): ParseResult {
  const res = format === 'csv' ? parseCsv(text) : parseTxt(text)
  if (res.rows.length > IMPORT_LIMITS.maxQuestions) {
    res.fileErrors.push(`This file has ${res.rows.length} questions. A set can hold at most ${IMPORT_LIMITS.maxQuestions} -- split the file into smaller sets.`)
  }
  return res
}

// --- Validation -------------------------------------------------------------

const HTML_TAG = /<\s*\/?\s*(script|style|iframe|object|embed|img|svg|a|div|span|p|br|b|i|u|font|table|html|body|link|meta)\b[^>]*>/i
const FORMULA = /^[=+@]|^-(?!\s*\d)/
const TRUE_WORDS = ['true', 'சரி', 'ஆம்']
const FALSE_WORDS = ['false', 'தவறு', 'இல்லை']

export function isTrueFalseAnswer(answer: string): boolean {
  const a = answer.trim().toLowerCase()
  return TRUE_WORDS.includes(a) || FALSE_WORDS.includes(a)
}

function checkText(label: string, value: string, max: number, errors: string[]) {
  if (value.length > max) errors.push(`${label} is too long (${value.length} characters; the limit is ${max}).`)
  if (HTML_TAG.test(value)) errors.push(`${label} contains HTML code. Please write plain text only.`)
  if (FORMULA.test(value)) errors.push(`${label} starts with "${value[0]}" like a spreadsheet formula. Remove it or put the text in quotes.`)
}

export function checkRows(rows: ImportRow[]): RowCheck[] {
  const seen = new Map<string, number>()
  return rows.map((r, idx) => {
    const errors: string[] = []
    const warnings: string[] = []
    if (!r.question) errors.push('The question is missing.')
    if (!r.answer) errors.push('The answer is missing.')
    checkText('The question', r.question, IMPORT_LIMITS.maxQuestionLength, errors)
    checkText('The answer', r.answer, IMPORT_LIMITS.maxAnswerLength, errors)
    if (r.explanation) checkText('The explanation', r.explanation, IMPORT_LIMITS.maxExplanationLength, errors)
    if (r.wrongAnswers.length > IMPORT_LIMITS.maxWrongAnswers) errors.push(`At most ${IMPORT_LIMITS.maxWrongAnswers} wrong answers can be given.`)
    r.wrongAnswers.forEach((w) => checkText('A wrong answer', w, IMPORT_LIMITS.maxAnswerLength, errors))
    const key = normalizeForComparison(r.question).toLowerCase().replace(/\s+/g, ' ')
    if (key) {
      const first = seen.get(key)
      if (first !== undefined) errors.push(`This is the same question as #${first + 1}. Change it or remove one of them.`)
      else seen.set(key, idx)
    }
    if (r.answer && r.wrongAnswers.some((w) => normalizeForComparison(w) === normalizeForComparison(r.answer))) errors.push('One of the wrong answers is the same as the answer.')
    const t = r.type.trim().toLowerCase()
    if (t && !['mc', 'multiple_choice', 'multiple choice', 'choice', 'text', 'typed', 'text_input', 'tf', 'true_false', 'true/false'].includes(t)) warnings.push(`Unknown type "${r.type}" -- it will be chosen automatically.`)
    if (['tf', 'true_false', 'true/false'].includes(t) && r.answer && !isTrueFalseAnswer(r.answer)) errors.push('A true/false question needs the answer True, False, சரி or தவறு.')
    return { errors: Array.from(new Set(errors)), warnings }
  })
}

// --- Building questions -------------------------------------------------------

export type AnswerStyle = 'choices' | 'typed'

export interface BuiltQuestion {
  questionType: GameRoomQuestionType
  prompt: string
  payload: Record<string, unknown>
  explanation: string | null
  conceptTags: string[]
}

// How one row will be played. Rules, in order:
// 1. The row names a type -> that type.
// 2. Wrong answers are given -> multiple choice with exactly those.
// 3. The answer is True/False (or சரி/தவறு) -> true/false.
// 4. "choices" style: multiple choice with three wrong answers of the
//    same kind as the answer -- borrowed from OTHER questions' answers in
//    the same file (same script: Tamil with Tamil, English with English,
//    closest length first), or, for a whole-number answer, nearby
//    numbers. Fewer than three of the same kind -> typed answer, rather
//    than options a student could rule out at a glance.
// 5. "typed" style -> typed answer; "a | b" in the answer = both accepted.
export function buildQuestion(row: ImportRow, all: ImportRow[], style: AnswerStyle): BuiltQuestion {
  const t = row.type.trim().toLowerCase()
  const tags = [row.topic, row.skill].map((x) => x.trim()).filter(Boolean)
  const base = { prompt: row.question.trim(), explanation: row.explanation.trim() || null, conceptTags: tags }
  const accepted = row.answer.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean)
  const main = accepted[0] ?? ''
  const wantsTyped = ['text', 'typed', 'text_input'].includes(t)
  const wantsTf = ['tf', 'true_false', 'true/false'].includes(t)
  const wantsChoice = ['mc', 'multiple_choice', 'multiple choice', 'choice'].includes(t)

  if (!wantsTyped && (wantsTf || (!wantsChoice && isTrueFalseAnswer(main) && row.wrongAnswers.length === 0))) {
    return { ...base, questionType: 'TRUE_FALSE', payload: { correctAnswer: TRUE_WORDS.includes(main.toLowerCase()) } }
  }
  if (!wantsTyped && row.wrongAnswers.length > 0) {
    return { ...base, questionType: 'MULTIPLE_CHOICE', payload: { options: shuffled([main, ...row.wrongAnswers], row.question), correctAnswer: main } }
  }
  if (!wantsTyped && (style === 'choices' || wantsChoice)) {
    const distractors = borrowDistractors(main, all)
    if (distractors.length >= 3 || (wantsChoice && distractors.length >= 1)) {
      return { ...base, questionType: 'MULTIPLE_CHOICE', payload: { options: shuffled([main, ...distractors], row.question), correctAnswer: main } }
    }
  }
  return { ...base, questionType: 'TEXT_INPUT', payload: { acceptedAnswers: accepted } }
}

const script = (s: string) => (/[஀-௿]/.test(s) ? 'ta' : /^[\d\s.,/-]+$/.test(s) ? 'num' : 'en')

function borrowDistractors(answer: string, all: ImportRow[]): string[] {
  const norm = (s: string) => normalizeForComparison(s).trim().toLowerCase()
  const mine = norm(answer)
  const pool = Array.from(
    new Map(
      all
        .map((r) => (r.answer.split(/\s*\|\s*/)[0] ?? '').trim())
        .filter((a) => a && norm(a) !== mine && !isTrueFalseAnswer(a))
        .map((a) => [norm(a), a] as const)
    ).values()
  )
  const sc = script(answer)
  const rand = mulberry32(seedFromString(answer))
  const same = pool
    .filter((a) => script(a) === sc)
    .map((a) => ({ a, score: Math.abs(a.length - answer.length) / Math.max(4, answer.length) + rand() * 0.5 }))
    .sort((x, y) => x.score - y.score)
    .slice(0, 3)
    .map((x) => x.a)
  if (same.length >= 3 || !/^\d{1,6}$/.test(answer.trim())) return same
  // Whole numbers: top up with nearby numbers ("how many ...?").
  const n = Number(answer.trim())
  const out = [...same]
  for (const d of [2, -2, 6, -6, 1, -1, 4, -4, 10]) {
    const v = n + d
    if (out.length >= 3) break
    if (v >= 0 && v !== n && !out.includes(String(v))) out.push(String(v))
  }
  return out
}

function shuffled(items: string[], seedText: string): string[] {
  const a = [...items]
  const rand = mulberry32(seedFromString(seedText))
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Final gate before sending: the same payload validation the builder
// and the server use.
export function payloadProblems(q: BuiltQuestion): string[] {
  return validateQuestionPayload(q.questionType, q.prompt, q.payload)
}

// --- Templates ----------------------------------------------------------------

export const TXT_TEMPLATE = `# Tamizhi question set -- TXT template
# One question per block. "Explanation" is optional. Leave a blank line between questions.
# Save this file as UTF-8 text.

Question: தமிழில் உயிரெழுத்துகள் எத்தனை?
Answer: 12
Explanation: தமிழில் 12 உயிரெழுத்துகள் உள்ளன.

Question: "மரம்" என்பது எந்தச் சொல்?
Answer: பெயர்ச்சொல்
Explanation: மரம் ஒரு பொருளின் பெயரைச் சுட்டுவதால் பெயர்ச்சொல்.

Question: தமிழ்நாட்டின் தலைநகர் எது?
Answer: சென்னை

Question: "ஓடினான்" என்பது எந்தச் சொல்?
Answer: வினைச்சொல்
Explanation: ஓடுதல் ஒரு செயலைக் குறிப்பதால் வினைச்சொல்.

Question: தமிழில் மெய்யெழுத்துகள் எத்தனை?
Answer: 18
Wrong answers: 12 | 30 | 247

Question: "அம்மா" என்பதன் பொருள் என்ன?
Answer: Mother
Explanation: அம்மா = Mother.

Question: திருக்குறள் 1330 குறள்களைக் கொண்டது.
Answer: சரி
`

export const CSV_TEMPLATE = `question,answer,explanation,wrong_answer_1,wrong_answer_2,wrong_answer_3
தமிழில் உயிரெழுத்துகள் எத்தனை?,12,தமிழில் 12 உயிரெழுத்துகள் உள்ளன.,,,
"""மரம்"" என்பது எந்தச் சொல்?",பெயர்ச்சொல்,மரம் ஒரு பொருளின் பெயரைச் சுட்டுவதால் பெயர்ச்சொல்.,,,
தமிழ்நாட்டின் தலைநகர் எது?,சென்னை,,,,
"""ஓடினான்"" என்பது எந்தச் சொல்?",வினைச்சொல்,ஓடுதல் ஒரு செயலைக் குறிப்பதால் வினைச்சொல்.,,,
தமிழில் மெய்யெழுத்துகள் எத்தனை?,18,,12,30,247
"""அம்மா"" என்பதன் பொருள் என்ன?",Mother,"அம்மா = Mother.",,,
திருக்குறள் 1330 குறள்களைக் கொண்டது.,சரி,,,,
`
