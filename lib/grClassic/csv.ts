import { toCsv } from './format'
import { clean, type QuestionInput } from './validateQuestion'
import type { QuestionKind } from './types'

// CSV import for the question library. One simple template per game type;
// the importer recognises which one a file uses from its header row.
// Files must be UTF-8 ("CSV UTF-8" in Excel, the default in Google Sheets)
// so Tamil comes through intact.

// Big enough for a whole topic bank; the bytes cap keeps the upload well
// under the hosting limit for one request (4.5 MB). Tamil is about 3 bytes
// a letter, so a 1000-question file is often over 512 KB.
export const MAX_IMPORT_ROWS = 2000
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024
export const MAX_IMPORT_SIZE_LABEL = '3 MB'

const PAIRS = [1, 2, 3, 4, 5, 6]

export const TEMPLATES: Record<QuestionKind, { file: string; label: string; headers: string[]; examples: string[][] }> = {
  choice: {
    file: 'gameroom-classic-quiz-template.csv',
    label: 'Quiz questions',
    headers: ['topic', 'question', 'question_english', 'answer_1', 'answer_2', 'answer_3', 'answer_4', 'correct_answer', 'explanation', 'difficulty'],
    examples: [
      ['உயிர் எழுத்துக்கள்', 'தமிழில் எத்தனை உயிர் எழுத்துக்கள் உள்ளன?', 'How many vowels are there in Tamil?', '10', '12', '18', '247', '2', 'அ முதல் ஔ வரை 12 உயிர் எழுத்துக்கள்.', 'easy'],
      ['வல்லினம் / மெல்லினம் / இடையினம்', 'இவற்றில் வல்லின எழுத்து எது?', 'Which one is வல்லினம்?', 'க', 'ங', 'ய', 'ம', '1', 'வல்லினம்: க ச ட த ப ற', 'easy'],
      ['திணை', '"மரம்" எந்தத் திணை?', 'Which திணை is "மரம்"?', 'உயர்திணை', 'அஃறிணை', '', '', '2', '', 'medium'],
    ],
  },
  match: {
    file: 'gameroom-classic-matching-template.csv',
    label: 'Matching pairs',
    headers: ['topic', 'instruction', 'instruction_english', ...PAIRS.flatMap((n) => [`left_${n}`, `right_${n}`]), 'difficulty'],
    examples: [
      ['சொல் பொருள்', 'சொல்லையும் பொருளையும் பொருத்துக', 'Match each word to its meaning', 'பூனை', 'cat', 'நாய்', 'dog', 'பசு', 'cow', 'யானை', 'elephant', '', '', '', '', 'easy'],
      ['வல்லினம் / மெல்லினம் / இடையினம்', 'எழுத்தையும் அதன் வகையையும் பொருத்துக', 'Match each letter to its group', 'க', 'வல்லினம்', 'ம', 'மெல்லினம்', 'ல', 'இடையினம்', '', '', '', '', '', '', 'medium'],
    ],
  },
  order: {
    file: 'gameroom-classic-word-builder-template.csv',
    label: 'Word Builder',
    headers: ['topic', 'word_or_sentence', 'clue_english', 'hint', 'difficulty'],
    examples: [
      ['உயிர் எழுத்துக்கள்', 'அம்மா', 'mother', 'அ-வில் தொடங்கும்', 'easy'],
      ['உயிர் எழுத்துக்கள்', 'கண்ணாடி', 'mirror', '', 'easy'],
      ['வாக்கிய அமைப்பு', 'நான் பள்ளிக்குச் செல்கிறேன்', 'I am going to school.', '', 'medium'],
    ],
  },
}

export function templateCsv(kind: QuestionKind): string {
  const t = TEMPLATES[kind]
  return toCsv([t.headers, ...t.examples])
}

// RFC 4180 CSV (quoted fields, "" escapes, commas/newlines inside quotes).
// Also accepts tab-separated text pasted from a spreadsheet.
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '')
  const firstLine = s.split(/\r?\n/, 1)[0] ?? ''
  const sep = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === sep) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

export interface ImportRow {
  line: number // spreadsheet row number (header = 1)
  topic: string
  input: QuestionInput
}

export type ParsedImport = { ok: true; kind: QuestionKind; rows: ImportRow[] } | { ok: false; error: string }

export function readImport(text: string): ParsedImport {
  if (text.includes('\uFFFD')) return { ok: false, error: 'Some Tamil letters came through as “\uFFFD”. Save the file as “CSV UTF-8” and upload it again.' }
  const table = parseCsv(text)
  if (table.length < 2) return { ok: false, error: 'The file has no questions under the header row.' }
  const headers = table[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => headers.indexOf(name)
  const kind: QuestionKind | null = col('question') >= 0 && col('answer_1') >= 0 ? 'choice' : col('left_1') >= 0 ? 'match' : col('word_or_sentence') >= 0 ? 'order' : null
  if (!kind) return { ok: false, error: 'This file doesn’t match a template. Download a template, fill it in, and keep its first row as it is.' }
  if (table.length - 1 > MAX_IMPORT_ROWS) return { ok: false, error: `A file can have at most ${MAX_IMPORT_ROWS} questions. Split it into smaller files.` }

  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (name: string) => {
      const k = col(name)
      return k >= 0 ? clean(cells[k] ?? '') : ''
    }
    const difficulty = get('difficulty').toLowerCase() || 'easy'
    let input: QuestionInput
    if (kind === 'choice') {
      const options = [1, 2, 3, 4].map((n) => get(`answer_${n}`))
      const correct = get('correct_answer')
      const byNumber = /^[1-4]$/.test(correct) ? Number(correct) - 1 : -1
      const byText = options.findIndex((o) => o && o === clean(correct))
      input = { kind, prompt: get('question'), promptEn: get('question_english'), options, answerIndex: byNumber >= 0 ? byNumber : byText, explanation: get('explanation'), difficulty }
    } else if (kind === 'match') {
      input = { kind, prompt: get('instruction'), promptEn: get('instruction_english'), pairs: PAIRS.map((n) => ({ left: get(`left_${n}`), right: get(`right_${n}`) })), difficulty }
    } else {
      input = { kind, answer: get('word_or_sentence'), promptEn: get('clue_english'), hint: get('hint'), difficulty }
    }
    return { line: i + 2, topic: get('topic'), input }
  })
  return { ok: true, kind, rows }
}

// Plain-text summary of a question for previews and lists.
export function summarize(input: QuestionInput): string {
  if (input.kind === 'match' && Array.isArray(input.pairs)) {
    return (input.pairs as { left?: unknown; right?: unknown }[])
      .filter((p) => clean(p.left) && clean(p.right))
      .map((p) => `${clean(p.left)} ↔ ${clean(p.right)}`)
      .join(', ')
  }
  if (input.kind === 'order') return clean(input.answer)
  return clean(input.prompt)
}
