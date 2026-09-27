// Teacher question-set import (.txt / .csv) -- driven against the real
// parser, checker and question builder (lib/gameRoomV2/import):
//   1. TXT: Tamil, English, mixed, optional explanation, multi-line,
//      blank lines, Tamil labels, wrong answers, malformed blocks
//   2. CSV: commas, quotes, newlines in quotes, BOM, ; delimiter,
//      unexpected columns, missing header, wrong_answer_N columns
//   3. Decoding: UTF-8 (+BOM), UTF-16, invalid bytes, binary, oversized
//   4. Validation: duplicates, long fields, HTML, formulas, too many
//   5. Built questions pass the same payload validation as the Builder
//      and the server; imported types are only ones the student state
//      route redacts (answer keys never reach students)
//   6. Wiring: the page is teacher-gated and saves through the Builder's
//      own POST route (server sets ownership and re-validates)
//
//   npx tsx scripts/verify-gameroom-v2-question-import.ts
import { readFileSync } from 'fs'
import {
  IMPORT_LIMITS,
  CSV_TEMPLATE,
  TXT_TEMPLATE,
  buildQuestion,
  checkRows,
  decodeImportBytes,
  formatForFileName,
  parseCsv,
  parseImport,
  parseTxt,
  payloadProblems,
  type ImportRow,
} from '../lib/gameRoomV2/import/questionImport'
import { validateQuestionSet } from '../lib/gameRoomV2/domain'
import { validateQuestionSetLimits } from '../lib/gameRoomV2/security/limits'
import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'

let failures = 0
let passes = 0
function assert(cond: unknown, msg: string) {
  if (cond) passes++
  else {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}
const read = (f: string) => readFileSync(f, 'utf8')
const enc = (s: string) => new TextEncoder().encode(s)
const errorsOf = (rows: ImportRow[]) => checkRows(rows).map((c) => c.errors)

// --- 1. TXT ---------------------------------------------------------------
console.log('1. TXT format')
{
  const txt = `Question: தமிழில் உயிரெழுத்துகள் எத்தனை?
Answer: 12
Explanation: தமிழில் 12 உயிரெழுத்துகள் உள்ளன.

Question: What is the capital of Tamil Nadu?
Answer: Chennai

Question: "அம்மா" means?
Answer: Mother
Explanation: அம்மா = Mother,
and அப்பா = Father.



Question: Which is a noun, "மரம்" or "ஓடு"?
Answer: மரம்
Question: Straight after, no blank line?
Answer: yes`
  const r = parseTxt(txt)
  assert(r.rows.length === 5, `5 questions detected (got ${r.rows.length})`)
  assert(r.rows[0].question === 'தமிழில் உயிரெழுத்துகள் எத்தனை?', 'Tamil question kept exactly')
  assert(r.rows[0].answer === '12' && r.rows[0].explanation.startsWith('தமிழில் 12'), 'Tamil answer + explanation')
  assert(r.rows[1].explanation === '', 'missing explanation is fine (empty)')
  assert(r.rows[2].explanation === 'அம்மா = Mother,\nand அப்பா = Father.', 'multi-line explanation joined with newline')
  assert(r.rows[3].question.includes('"மரம்" or "ஓடு"'), 'quotes and commas kept in TXT')
  assert(r.rows[4].question === 'Straight after, no blank line?', 'a new Question: label starts a new question')
  assert(r.rows[0].line === 1 && r.rows[1].line === 5, 'line numbers point to the question start')
  assert(errorsOf(r.rows).every((e) => e.length === 0), 'all well-formed TXT rows are valid')

  const ta = parseTxt('கேள்வி: பூனை என்பதன் ஆங்கிலம்?\nவிடை: Cat\nவிளக்கம்: பூனை = Cat\nதவறான விடைகள்: Dog | Cow ; Hen')
  assert(ta.rows.length === 1 && ta.rows[0].answer === 'Cat' && ta.rows[0].explanation === 'பூனை = Cat', 'Tamil labels work')
  assert(ta.rows[0].wrongAnswers.join(',') === 'Dog,Cow,Hen', 'wrong answers split on | and ;')

  const pipes = parseTxt('Capital of India? | New Delhi | It is the capital.\nSecond? | Two')
  assert(pipes.rows.length === 2 && pipes.rows[0].answer === 'New Delhi' && pipes.rows[1].explanation === '', 'q | a | e lines')

  const dash = parseTxt('Question: What is 5 - 3?\nAnswer: 2\nA-list celebrities are?\n')
  assert(dash.rows[0].question.includes('5 - 3'), 'a dash inside a question is not a label')
  assert(dash.rows[0].answer.startsWith('2'), 'answer kept; "A-list" is not mistaken for an Answer label')

  const malformed = parseTxt('Question: No answer here\n\nAnswer: No question here\n\nJust a stray line')
  const me = errorsOf(malformed.rows)
  assert(malformed.rows.length === 3, 'malformed blocks are kept for the preview, not silently dropped')
  assert(me[0].some((e) => /answer is missing/.test(e)), 'missing answer flagged')
  assert(me[1].some((e) => /question is missing/.test(e)), 'missing question flagged')
  assert(me[2].some((e) => /answer is missing/.test(e)), 'stray line flagged')

  const empty = parseTxt('\n\n# only comments\n')
  assert(empty.rows.length === 0 && empty.notices.length === 1, 'empty file -> helpful notice')

  const crlf = decodeImportBytes(enc('Question: a?\r\nAnswer: b\r\n\r\nQuestion: c?\r\nAnswer: d\r\n'))
  assert('text' in crlf && parseTxt(crlf.text).rows.length === 2, 'Windows line endings')
}

// --- 2. CSV ---------------------------------------------------------------
console.log('2. CSV format')
{
  const csv = `question,answer,explanation
தமிழில் உயிரெழுத்துகள் எத்தனை?,12,தமிழில் 12 உயிரெழுத்துகள் உள்ளன.
"Tamil, English, and more?",Yes,"Commas inside quotes, kept."
"He said ""வணக்கம்""",Hello,
"A question
over two lines",answer,"Line one
line two"
,,
Missing answer,,
`
  const r = parseCsv(csv)
  assert(r.fileErrors.length === 0, 'valid header accepted')
  assert(r.rows.length === 5, `5 data rows (blank row skipped) (got ${r.rows.length})`)
  assert(r.rows[1].question === 'Tamil, English, and more?' && r.rows[1].explanation === 'Commas inside quotes, kept.', 'commas in quoted fields')
  assert(r.rows[2].question === 'He said "வணக்கம்"', 'escaped quotes')
  assert(r.rows[2].explanation === '', 'missing explanation (trailing comma)')
  assert(r.rows[3].question === 'A question\nover two lines' && r.rows[3].explanation === 'Line one\nline two', 'newlines inside quotes')
  assert(r.rows[4].line === 9, `line numbers account for multi-line cells (got ${r.rows[4].line})`)
  const errs = errorsOf(r.rows)
  assert(errs.slice(0, 4).every((e) => e.length === 0) && errs[4].some((e) => /answer is missing/.test(e)), 'only the malformed row is flagged')

  const extra = parseCsv('Question,Answer,Explanation,Hint,Difficulty,Topic,Skill,Type,Wrong Answer 1,wrong_answer_2,wrong_answer_3,Notes\nq?,a,e,h,easy,Letters,Reading,mc,b,c,d,xyz')
  assert(extra.fileErrors.length === 0, 'full optional header accepted (case/space-insensitive)')
  assert(extra.notices.some((n) => /ignored: notes/.test(n)), 'unexpected column reported, not fatal')
  assert(extra.notices.some((n) => /hint/i.test(n)) && extra.notices.some((n) => /difficulty/i.test(n)), 'hint/difficulty columns explained')
  const row = extra.rows[0]
  assert(row.wrongAnswers.join(',') === 'b,c,d' && row.topic === 'Letters' && row.skill === 'Reading' && row.type === 'mc', 'optional columns mapped')

  const semi = parseCsv('question;answer\n"a; b?";c')
  assert(semi.rows.length === 1 && semi.rows[0].question === 'a; b?', 'semicolon-delimited CSV (European Excel)')
  const tab = parseCsv('question\tanswer\nq?\tA')
  assert(tab.rows.length === 1 && tab.rows[0].answer === 'A', 'tab-delimited')
  const taHeader = parseCsv('கேள்வி,விடை,விளக்கம்\nq?,a,')
  assert(taHeader.rows.length === 1, 'Tamil column names')

  const noHeader = parseCsv('What is 2+2?,4,maths')
  assert(noHeader.fileErrors.length === 1 && noHeader.rows.length === 0, 'missing header -> clear file error')
  const bom = decodeImportBytes(new Uint8Array([0xef, 0xbb, 0xbf].concat(Array.from(enc('question,answer\nq?,a\n')))))
  assert('text' in bom && parseCsv(bom.text).rows.length === 1, 'UTF-8 BOM (Excel "CSV UTF-8") handled')
  const ragged = parseCsv('question,answer,explanation\nq?,a\nq2?,b,e,extra,cells')
  assert(ragged.rows.length === 2 && ragged.rows[1].explanation === 'e', 'short and long rows tolerated')
}

// --- 3. Decoding and file checks -------------------------------------------
console.log('3. Decoding and file checks')
{
  assert(formatForFileName('Set 1.CSV') === 'csv' && formatForFileName('a.txt') === 'txt', 'extensions (case-insensitive)')
  for (const bad of ['a.xlsx', 'a.csv.exe', 'a.html', 'a', 'a.js', 'a.txt.svg']) assert(formatForFileName(bad) === null, `rejects ${bad}`)
  const tamil = 'Question: வணக்கம் என்றால்?\nAnswer: Hello'
  const utf8 = decodeImportBytes(enc(tamil))
  assert('text' in utf8 && utf8.text === tamil, 'UTF-8 Tamil round-trips')
  const u16 = new Uint8Array(2 + tamil.length * 2)
  u16[0] = 0xff
  u16[1] = 0xfe
  for (let i = 0; i < tamil.length; i++) {
    u16[2 + i * 2] = tamil.charCodeAt(i) & 0xff
    u16[3 + i * 2] = tamil.charCodeAt(i) >> 8
  }
  const d16 = decodeImportBytes(u16)
  assert('text' in d16 && d16.text === tamil, 'UTF-16LE with BOM (Excel "Unicode text")')
  const latin1 = decodeImportBytes(new Uint8Array([0x51, 0x3a, 0x20, 0xe9, 0xe8, 0x0a]))
  assert('error' in latin1 && /UTF-8/.test(latin1.error), 'non-UTF-8 bytes refused with a plain explanation')
  const binary = decodeImportBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))
  assert('error' in binary, 'binary (e.g. a renamed .xlsx zip) refused')
  const big = decodeImportBytes(new Uint8Array(IMPORT_LIMITS.maxFileBytes + 1).fill(0x41))
  assert('error' in big && /too large/.test(big.error), 'oversized file refused before decoding')
  const decomposed = decodeImportBytes(enc('Question: கொ\nAnswer: x'.replace('கொ', 'கொ')))
  assert('text' in decomposed && decomposed.text.includes('கொ'), 'Tamil normalised to NFC')
  const zw = parseTxt('Question: a​\u0007b?\nAnswer: c')
  assert(zw.rows[0].question === 'ab?', 'zero-width and control characters stripped')
}

// --- 4. Validation ------------------------------------------------------------
console.log('4. Validation')
{
  const dup = parseTxt('Question: தலைநகர் எது?\nAnswer: சென்னை\n\nQuestion:  தலைநகர்   எது? \nAnswer: Chennai')
  const de = errorsOf(dup.rows)
  assert(de[0].length === 0 && de[1].some((e) => /same question as #1/.test(e)), 'duplicate question flagged against the first')

  const longQ = 'அ'.repeat(IMPORT_LIMITS.maxQuestionLength + 1)
  const longA = 'b'.repeat(IMPORT_LIMITS.maxAnswerLength + 1)
  const longE = 'c'.repeat(IMPORT_LIMITS.maxExplanationLength + 1)
  const le = errorsOf(parseTxt(`Question: ${longQ}\nAnswer: ${longA}\nExplanation: ${longE}`).rows)[0]
  assert(le.filter((e) => /too long/.test(e)).length === 3, 'long question, answer and explanation each flagged')

  const html = errorsOf(parseTxt('Question: <script>alert(1)</script>\nAnswer: <img src=x onerror=alert(1)>').rows)[0]
  assert(html.filter((e) => /HTML/.test(e)).length === 2, 'HTML/script in fields refused')
  const ok = errorsOf(parseTxt('Question: Is 3 < 5 and 7 > 2?\nAnswer: சரி').rows)[0]
  assert(ok.length === 0, 'maths with < and > is not mistaken for HTML')

  const formulas = parseCsv('question,answer,explanation\n=HYPERLINK("http://x"),a,\n+SUM(A1),b,\n@cmd,c,\nq?,-cmd,\nWhat is -5 + 2?,-3,')
  const fe = errorsOf(formulas.rows)
  assert(fe[0].some((e) => /formula/.test(e)) && fe[1].some((e) => /formula/.test(e)) && fe[2].some((e) => /formula/.test(e)) && fe[3].some((e) => /formula/.test(e)), 'spreadsheet formulas (= + @ -) refused')
  assert(fe[4].length === 0, 'a negative number answer is allowed')

  const same = errorsOf(parseTxt('Question: q?\nAnswer: x\nWrong answers: y | x').rows)[0]
  assert(same.some((e) => /same as the answer/.test(e)), 'wrong answer equal to the answer flagged')
  const tf = errorsOf(parseTxt('Question: q?\nAnswer: maybe\nType: tf').rows)[0]
  assert(tf.some((e) => /true\/false/.test(e)), 'bad true/false answer flagged')

  const many = Array.from({ length: IMPORT_LIMITS.maxQuestions + 1 }, (_, i) => `Question: q${i}?\nAnswer: a${i}`).join('\n\n')
  const mr = parseImport('txt', many)
  assert(mr.fileErrors.some((e) => /at most 200/.test(e)), 'too many questions -> file error')
  const exact = parseImport('txt', many.split('\n\n').slice(0, IMPORT_LIMITS.maxQuestions).join('\n\n'))
  assert(exact.fileErrors.length === 0 && exact.rows.length === IMPORT_LIMITS.maxQuestions, 'exactly 200 is allowed')
}

// --- 5. Building questions ------------------------------------------------------
console.log('5. Built questions')
{
  const t = parseImport('txt', TXT_TEMPLATE)
  const c = parseImport('csv', CSV_TEMPLATE)
  assert(t.rows.length === 7 && c.rows.length === 7, `templates parse to 7 questions each (txt ${t.rows.length}, csv ${c.rows.length})`)
  assert(errorsOf(t.rows).every((e) => !e.length) && errorsOf(c.rows).every((e) => !e.length), 'templates have no problems')
  assert(t.fileErrors.length + c.fileErrors.length === 0, 'templates have no file errors')

  for (const [name, res] of [['txt', t], ['csv', c]] as const) {
    for (const style of ['choices', 'typed'] as const) {
      const built = res.rows.map((r) => buildQuestion(r, res.rows, style))
      const probs = built.flatMap(payloadProblems)
      assert(probs.length === 0, `${name}/${style}: every payload passes validateQuestionPayload (${probs.join('; ')})`)
      const setProbs = validateQuestionSet(built.map((q) => ({ questionType: q.questionType, prompt: q.prompt, payload: q.payload })))
      assert(setProbs.length === 0, `${name}/${style}: validateQuestionSet (server) accepts the set (${setProbs.join('; ')})`)
      const limits = validateQuestionSetLimits({ title: 'Imported', description: null, tags: ['imported'], questions: built.map((q) => ({ ...q, points: 100, mediaUrl: null })) })
      assert(limits.length === 0, `${name}/${style}: server size limits accept the set (${limits.join('; ')})`)
      // Grading: the answer written in the file is graded correct.
      built.forEach((q, i) => {
        const main = res.rows[i].answer.split('|')[0].trim()
        const answer = q.questionType === 'TRUE_FALSE' ? (q.payload as { correctAnswer: boolean }).correctAnswer : main
        assert(gradeAnswer(q.questionType, q.payload, answer), `${name}/${style} #${i + 1}: the file's answer grades correct (${q.questionType})`)
      })
    }
  }

  const rows = parseTxt('Question: Tamil vowels?\nAnswer: 12\n\nQuestion: capital?\nAnswer: சென்னை\n\nQuestion: noun?\nAnswer: பெயர்ச்சொல்\n\nQuestion: verb?\nAnswer: வினைச்சொல்\n\nQuestion: TN river?\nAnswer: காவிரி\n\nQuestion: consonants?\nAnswer: 18\nWrong answers: 12 | 30 | 247\n\nQuestion: Kural count 1330.\nAnswer: சரி\n\nQuestion: Colour?\nAnswer: red | சிவப்பு\nType: text').rows
  const mc = buildQuestion(rows[1], rows, 'choices')
  const opts = (mc.payload as { options: string[] }).options
  assert(mc.questionType === 'MULTIPLE_CHOICE' && opts.length === 4 && opts.includes('சென்னை'), 'choices style: 4 options including the answer')
  assert(opts.filter((o) => /[஀-௿]/.test(o)).length === 4, 'borrowed distractors match the answer script (Tamil)')
  assert(new Set(opts).size === 4, 'no repeated options')
  assert(JSON.stringify(buildQuestion(rows[1], rows, 'choices')) === JSON.stringify(mc), 'deterministic (same file -> same set)')
  const given = buildQuestion(rows[5], rows, 'typed')
  assert(given.questionType === 'MULTIPLE_CHOICE' && (given.payload as { options: string[] }).options.sort().join(',') === '12,18,247,30', 'explicit wrong answers -> multiple choice with exactly those')
  const tfq = buildQuestion(rows[6], rows, 'choices')
  assert(tfq.questionType === 'TRUE_FALSE' && (tfq.payload as { correctAnswer: boolean }).correctAnswer === true, 'சரி -> true/false (true)')
  const typed = buildQuestion(rows[1], rows, 'typed')
  assert(typed.questionType === 'TEXT_INPUT' && gradeAnswer('TEXT_INPUT', typed.payload, ' சென்னை '), 'typed style -> typed answer, graded with trimming')
  const alt = buildQuestion(rows[7], rows, 'choices')
  assert(alt.questionType === 'TEXT_INPUT' && gradeAnswer('TEXT_INPUT', alt.payload, 'சிவப்பு') && gradeAnswer('TEXT_INPUT', alt.payload, 'RED'), '"a | b" answers both accepted; Type: text honoured')
  const lonely = parseTxt('Question: only one?\nAnswer: yes-ish').rows
  assert(buildQuestion(lonely[0], lonely, 'choices').questionType === 'TEXT_INPUT', 'too few other answers -> falls back to typed answer')
  const tagged = parseCsv('question,answer,topic,skill\nq?,a,எழுத்துகள்,Reading').rows[0]
  assert(buildQuestion(tagged, [tagged], 'typed').conceptTags.join('|') === 'எழுத்துகள்|Reading', 'topic/skill become concept tags')
  const explained = buildQuestion(rows[0], rows, 'typed')
  assert(explained.explanation === null, 'missing explanation saved as null (like the Builder)')
}

// --- 6. Answer keys and wiring ---------------------------------------------------
console.log('6. Answer-key protection and wiring')
{
  const importSrc = read('lib/gameRoomV2/import/questionImport.ts')
  const types = Array.from(new Set(Array.from(importSrc.matchAll(/questionType: '([A-Z_]+)'/g)).map((m) => m[1])))
  assert(types.sort().join(',') === 'MULTIPLE_CHOICE,TEXT_INPUT,TRUE_FALSE', `import produces only MC / TF / typed (${types.join(',')})`)
  const state = read('app/api/gameroom-v2/sessions/[id]/state/route.ts')
  const block = (t: string) => state.split(`case '${t}':`)[1]?.split('break')[0] ?? ''
  assert(/options: shuffledOptionsFor/.test(block('MULTIPLE_CHOICE')) && !/correctAnswer/.test(block('MULTIPLE_CHOICE')), 'student state: MC sends shuffled options only')
  assert(/safePayload = \{\}/.test(block('TRUE_FALSE')), 'student state: TF sends no payload')
  assert(/safePayload = \{\}/.test(block('TEXT_INPUT')), 'student state: typed answer sends no accepted answers')
  assert(/stripAnswerKey\(question/.test(state), 'student state route always strips the answer key')

  const wizard = read('components/gameRoomV2/builder/ImportWizard.tsx')
  assert(/fetch\('\/api\/gameroom-v2\/question-sets'/.test(wizard) && /method: 'POST'/.test(wizard), 'wizard saves through the Builder POST route')
  const body = wizard.split('const body = {')[1]?.split('const res = await fetch')[0] ?? ''
  assert(body.length > 0 && !/created_by|createdBy|profileId|teacherId|owner/.test(body), 'client sends no ownership field')
  assert(!/dangerouslySetInnerHTML|innerHTML|eval\(|new Function/.test(wizard + importSrc), 'no HTML injection or code evaluation')
  assert(/file\.size > IMPORT_LIMITS\.maxFileBytes/.test(wizard), 'size checked before the file is read')
  assert(/ALLOWED_MIME/.test(wizard) && /formatForFileName/.test(wizard), 'extension and MIME checked')
  assert(/visibility: 'PRIVATE'/.test(wizard), 'imported sets start private')

  const route = read('app/api/gameroom-v2/question-sets/route.ts')
  const post = route.split('export async function POST')[1] ?? ''
  assert(/requireGameV2Teacher\(\)/.test(post), 'POST is teacher-guarded')
  assert(/created_by: profile\.id/.test(post), 'server sets created_by from the session')
  assert(/validateQuestionSetLimits/.test(post) && /validateQuestionSet\(/.test(post), 'server re-validates limits and payloads')

  const page = read('app/gameroom-v2/library/import/page.tsx')
  assert(/requireGameV2Teacher\(\)/.test(page), 'import page is teacher-gated')
  assert(/library\/import/.test(read('app/gameroom-v2/library/page.tsx')), 'library links to import')
  assert(/library\/import/.test(read('app/gameroom-v2/TeacherHome.tsx')), 'teacher home links to import')
}

console.log(`\n${passes} passed, ${failures} failed`)
if (failures) {
  console.error('QUESTION IMPORT VERIFICATION FAILED')
  process.exit(1)
}
console.log('QUESTION IMPORT VERIFICATION PASSED')
