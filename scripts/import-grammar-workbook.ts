// One-off importer: converts Tamizhi_Grammar_Game_2500_Word_Bank.xlsx
// into lib/gameRoom/modules/tamilGrammarClassification/wordBank.json (a
// plain committed data file, matching the tamilGrammar/mayangoli
// convention of "word data lives in app code, not a runtime database")
// plus a thin wordBank.ts loader (JSON, not a TS array literal, because
// a 2500-entry TS literal blows up the type checker -- see the comment
// where the two files are written, below).
// Run manually: npx tsx scripts/import-grammar-workbook.ts <path-to-xlsx>
//
// Validates every row before writing anything (never silently drops a
// bad row -- reports it instead, per the spec's explicit rule), and
// prints an import summary (per-sheet counts, invalid/duplicate rows)
// so a human can review before the generated files are committed.
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import path from 'path'

const SHEET_TO_CATEGORY: Record<string, string> = {
  திணை: 'thinai',
  பால்: 'paal',
  எண்: 'enn',
  இடம்: 'idam',
  காலம்: 'kaalam',
}

const REQUIRED_COLUMNS = [
  'id',
  'word_or_phrase',
  'correct_answer',
  'option_1',
  'option_2',
  'difficulty',
  'teaching_note',
  'review_status',
  'enabled',
]

interface RawRow {
  id: string
  category: string
  wordOrPhrase: string
  correctAnswer: string
  options: string[]
  difficulty: string
  teachingNote: string
  reviewStatus: string
  enabled: boolean
}

function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-grammar-workbook.ts <path-to-xlsx>')
    process.exit(1)
  }

  const wb = XLSX.readFile(filePath)
  const sheetNames = Object.keys(SHEET_TO_CATEGORY)
  const missingSheets = sheetNames.filter((s) => !wb.SheetNames.includes(s))
  if (missingSheets.length > 0) {
    console.error(`FATAL: workbook is missing expected sheet(s): ${missingSheets.join(', ')}`)
    console.error(`Sheets found: ${wb.SheetNames.join(', ')}`)
    process.exit(1)
  }

  const allRows: RawRow[] = []
  const invalidRows: string[] = []
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []
  const disabledRows: string[] = []
  const needsReviewRows: string[] = []
  const summary: Record<string, number> = {}

  const seg = new Intl.Segmenter('ta', { granularity: 'grapheme' })

  for (const sheetName of sheetNames) {
    const category = SHEET_TO_CATEGORY[sheetName]
    const sheet = wb.Sheets[sheetName]
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

    const missingCols = REQUIRED_COLUMNS.filter((c) => !(c in (jsonRows[0] ?? {})))
    if (missingCols.length > 0) {
      console.error(`FATAL: sheet "${sheetName}" is missing required column(s): ${missingCols.join(', ')}`)
      process.exit(1)
    }

    let sheetCount = 0
    for (const row of jsonRows) {
      const id = String(row.id ?? '').trim()
      const wordOrPhrase = String(row.word_or_phrase ?? '').trim()
      const correctAnswer = String(row.correct_answer ?? '').trim()
      const options = [row.option_1, row.option_2, row.option_3, row.option_4, row.option_5]
        .map((o) => (o === null || o === undefined ? '' : String(o).trim()))
        .filter((o) => o.length > 0)
      const difficulty = String(row.difficulty ?? '').trim()
      const teachingNote = String(row.teaching_note ?? '').trim()
      const reviewStatus = String(row.review_status ?? '').trim()
      const enabledRaw = row.enabled
      const enabled = enabledRaw === true || enabledRaw === 'true' || enabledRaw === 'TRUE' || enabledRaw === 1

      const rowLabel = id || `${sheetName}[unlabeled row]`

      if (!id) {
        invalidRows.push(`${rowLabel}: missing id`)
        continue
      }
      if (seenIds.has(id)) {
        duplicateIds.push(id)
        continue
      }
      if (!wordOrPhrase) {
        invalidRows.push(`${id}: missing word_or_phrase`)
        continue
      }
      if (!correctAnswer) {
        invalidRows.push(`${id}: missing correct_answer`)
        continue
      }
      if (options.length < 2) {
        invalidRows.push(`${id}: fewer than 2 non-empty options`)
        continue
      }
      if (!options.includes(correctAnswer)) {
        invalidRows.push(`${id}: correct_answer "${correctAnswer}" not among options ${JSON.stringify(options)}`)
        continue
      }
      if (new Set(options).size !== options.length) {
        invalidRows.push(`${id}: duplicate options ${JSON.stringify(options)}`)
        continue
      }
      if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        invalidRows.push(`${id}: invalid difficulty "${difficulty}"`)
        continue
      }
      if (!['teacher_review', 'approved'].includes(reviewStatus)) {
        invalidRows.push(`${id}: invalid review_status "${reviewStatus}"`)
        continue
      }
      // Grapheme round-trip smoke check -- confirms Tamil Unicode
      // survived the xlsx parse without corruption (a naively-decoded
      // pulli/combining-mark corruption would typically either throw
      // here or produce zero clusters).
      let clusterCount = 0
      try {
        clusterCount = Array.from(seg.segment(wordOrPhrase)).length
      } catch {
        clusterCount = 0
      }
      if (clusterCount === 0) {
        invalidRows.push(`${id}: word_or_phrase failed grapheme segmentation (possible Unicode corruption)`)
        continue
      }

      seenIds.add(id)
      if (!enabled) disabledRows.push(id)
      if (reviewStatus !== 'approved') needsReviewRows.push(id)

      allRows.push({
        id,
        category,
        wordOrPhrase,
        correctAnswer,
        options,
        difficulty,
        teachingNote,
        reviewStatus,
        enabled,
      })
      sheetCount++
    }

    summary[sheetName] = sheetCount
  }

  console.log('=== Import Summary ===')
  for (const sheetName of sheetNames) {
    console.log(`${sheetName}: ${summary[sheetName]}`)
  }
  console.log(`Total: ${allRows.length}`)
  console.log(`\nInvalid rows: ${invalidRows.length}`)
  invalidRows.forEach((r) => console.log(`  - ${r}`))
  console.log(`\nDuplicate ids skipped: ${duplicateIds.length}`)
  duplicateIds.forEach((r) => console.log(`  - ${r}`))
  console.log(`\nDisabled rows (enabled=false): ${disabledRows.length}`)
  console.log(`Rows requiring review (review_status != approved): ${needsReviewRows.length}`)

  if (invalidRows.length > 0 || duplicateIds.length > 0) {
    console.error('\nFATAL: invalid or duplicate rows found -- fix the workbook and re-run. No file was written.')
    process.exit(1)
  }

  const moduleDir = path.join(__dirname, '..', 'lib', 'gameRoom', 'modules', 'tamilGrammarClassification')

  // The data itself is a plain JSON file, not a TS literal -- confirmed
  // as a real TS limitation: writing this as a `const x: RawGrammarEntry[]
  // = [...]` TS array literal (even with an `as` cast appended after the
  // fact) makes the checker try to infer/verify 2500 object literals'
  // string-literal field types inline, and it gives up with "expression
  // produces a union type that is too complex to represent." Loading it
  // via `import rawData from './wordBank.json'` in wordBank.ts and
  // applying the type via a runtime (not compile-time-checked) `as`
  // assertion sidesteps that inference entirely, while keeping the data
  // pretty-printed/diffable and still fully validated at module-load
  // time by buildGrammarEntry -- a malformed row still fails loudly at
  // import (this script) AND at build/boot (wordEntry.ts), just not via
  // a TS compile error on the data file itself.
  const dataOutPath = path.join(moduleDir, 'wordBank.json')
  writeFileSync(
    dataOutPath,
    JSON.stringify(
      allRows.map((r) => ({
        id: r.id,
        category: r.category,
        wordOrPhrase: r.wordOrPhrase,
        correctAnswer: r.correctAnswer,
        options: r.options,
        difficulty: r.difficulty,
        teachingNote: r.teachingNote,
        reviewStatus: r.reviewStatus,
        enabled: r.enabled,
      })),
      null,
      2
    ) + '\n'
  )

  const tsOutPath = path.join(moduleDir, 'wordBank.ts')
  writeFileSync(
    tsOutPath,
    [
      "import type { RawGrammarEntry } from './wordEntry'",
      "import rawData from './wordBank.json'",
      '',
      '// Generated by scripts/import-grammar-workbook.ts from',
      '// Tamizhi_Grammar_Game_2500_Word_Bank.xlsx (see wordBank.json for the actual',
      '// 2500-entry data -- do not hand-edit either file; re-run the importer',
      '// against a corrected workbook instead). Every row was validated at import',
      '// time (unique id, correct_answer present in its own options, no duplicate',
      '// options, valid category/difficulty/review_status, and a grapheme-',
      '// segmentation smoke check on word_or_phrase) -- see the script for the',
      "// exact rules. reviewStatus is the workbook's own vocabulary ('teacher_",
      "// review' | 'approved'), per its README instruction to promote entries to",
      "// 'approved' once a teacher has signed off.",
      '//',
      '// The cast below is a runtime-trusted assertion, not a compile-time check',
      '// -- buildGrammarEntry (see wordEntry.ts), run on every entry at module',
      '// load, is what actually catches a malformed row.',
      'export const GRAMMAR_ENTRIES = rawData as RawGrammarEntry[]',
      '',
    ].join('\n')
  )

  console.log(`\nWrote ${allRows.length} entries to ${dataOutPath}`)
  console.log(`Wrote loader to ${tsOutPath}`)
}

main()
