// Standalone verification script for the GameRoom V2 security /
// data-integrity audit (migration 083, docs/gameroom-v2-completion-plan.md
// Phase 14). Same tsx-script convention as every other
// verify-gameroom-v2-*.ts script (no formal test framework exists in
// this repo).
//
// This repo has no local Postgres harness, so RLS and grants can't be
// exercised against a live database here. Instead, sections 4-6 replay
// the GameRoom V2 migrations' policy/grant/function history IN ORDER and
// assert on the resulting effective state -- a regression guard that
// fails the moment a later migration re-opens a write policy, re-grants a
// reward RPC, or drops a caller check. Section 7 scans route source for
// writes that bypass the server-only admin client.
//
// Threat model: a student with devtools. Their browser holds a Clerk
// JWT Supabase accepts plus the public anon key, so anything the
// `authenticated` role can do, they can do by hand.
//
// Run with: npx tsx scripts/verify-gameroom-v2-security.ts

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import {
  MAX_SUBMITTED_ANSWER_BYTES,
  QUESTION_SET_LIMITS,
  checkSubmittedAnswer,
  isSafeMediaUrl,
  validateQuestionSetLimits,
  planQuestionReplacement,
  exceedsSessionStartLimit,
  SESSION_START_LIMIT,
  studentMayControlPause,
} from '../lib/gameRoomV2/security/limits'
import { gradeAnswer } from '../lib/gameRoomV2/gradeAnswer'

const ROOT = join(__dirname, '..')
let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

// ---------------------------------------------------------------------
console.log('== 1. Submitted-answer size cap (client-controlled payloads) ==')
assert(checkSubmittedAnswer('அம்மா').ok, 'a normal Tamil text answer is accepted')
assert(checkSubmittedAnswer(null).ok, 'a timeout (null) answer is accepted')
assert(checkSubmittedAnswer(undefined).ok, 'an omitted answer is accepted')
assert(checkSubmittedAnswer({ அ: 'உயிர்', க: 'மெய்' }).ok, 'a small MATCH/CATEGORIZE map is accepted')
assert(!checkSubmittedAnswer('x'.repeat(MAX_SUBMITTED_ANSWER_BYTES + 1)).ok, 'an answer one byte over the cap is rejected')
assert(
  !checkSubmittedAnswer('அ'.repeat(Math.ceil(MAX_SUBMITTED_ANSWER_BYTES / 3) + 10)).ok,
  'the cap is measured in UTF-8 bytes, not UTF-16 length (Tamil is 3 bytes per code point)'
)
assert(!checkSubmittedAnswer(Array.from({ length: 5000 }, (_, i) => `w${i}`)).ok, 'a huge array answer is rejected')
const circular: Record<string, unknown> = {}
circular.self = circular
assert(!checkSubmittedAnswer(circular).ok, 'a non-serializable answer is rejected rather than throwing')

// ---------------------------------------------------------------------
console.log('\n== 2. Grading never trusts client-controlled shapes ==')
const mc = { options: ['அ', 'ஆ', 'இ'], correctAnswer: 'ஆ' }
assert(gradeAnswer('MULTIPLE_CHOICE', mc, 'ஆ') === true, 'MULTIPLE_CHOICE: the right option grades correct')
assert(gradeAnswer('MULTIPLE_CHOICE', mc, ['ஆ']) === false, 'MULTIPLE_CHOICE: an array wrapping the right option is not accepted')
assert(gradeAnswer('MULTIPLE_CHOICE', mc, { correctAnswer: 'ஆ' }) === false, 'MULTIPLE_CHOICE: an object echoing correctAnswer is not accepted')
assert(gradeAnswer('MULTIPLE_CHOICE', mc, true) === false, 'MULTIPLE_CHOICE: a boolean is not accepted')
assert(gradeAnswer('TRUE_FALSE', { correctAnswer: true }, 'true') === false, 'TRUE_FALSE: the string "true" is not the boolean true')
assert(gradeAnswer('TRUE_FALSE', { correctAnswer: false }, 0) === false, 'TRUE_FALSE: a falsy number is not the boolean false')
assert(gradeAnswer('TEXT_INPUT', { acceptedAnswers: ['பூ'] }, ['பூ']) === false, 'TEXT_INPUT: an array is not accepted')
assert(gradeAnswer('TEXT_INPUT', { acceptedAnswers: [] }, '') === false, 'TEXT_INPUT: an empty answer never matches an empty accepted list')
assert(gradeAnswer('FILL_BLANK', { blanks: [['அ'], ['ஆ']] }, ['அ', 'ஆ', 'இ']) === false, 'FILL_BLANK: extra blanks are rejected')
assert(gradeAnswer('FILL_BLANK', { blanks: [['அ'], ['ஆ']] }, ['அ']) === false, 'FILL_BLANK: missing blanks are rejected')
const match = { pairs: [{ left: 'அ', right: 'a' }, { left: 'ஆ', right: 'aa' }] }
assert(gradeAnswer('MATCH', match, { அ: 'a', ஆ: 'aa' }) === true, 'MATCH: a fully correct mapping grades correct')
assert(gradeAnswer('MATCH', match, { அ: 'a' }) === false, 'MATCH: a partial mapping is not correct')
assert(gradeAnswer('MATCH', match, ['a', 'aa']) === false, 'MATCH: an array is not a mapping')
assert(gradeAnswer('MATCH', { pairs: [] }, {}) === false, 'MATCH: an empty pair list can never be "correct"')
const cat = { items: ['க', 'ங'], categories: ['வல்லினம்', 'மெல்லினம்'], answerKey: { க: 'வல்லினம்', ங: 'மெல்லினம்' } }
assert(gradeAnswer('CATEGORIZE', cat, { க: 'வல்லினம்' }) === false, 'CATEGORIZE: an incomplete categorization is not correct')
assert(gradeAnswer('CATEGORIZE', { items: [], categories: [], answerKey: {} }, {}) === false, 'CATEGORIZE: an empty item list can never be "correct"')
assert(gradeAnswer('ORDER_LETTERS', { letters: ['ம', 'ா', 'அ'], correctOrder: ['அ', 'ம', 'ா'] }, 'அமா') === false, 'ORDER_LETTERS: a joined string is not an ordered array')
assert(gradeAnswer('PRONUNCIATION', {}, 'anything') === false, 'an unimplemented question type always grades false')
assert(gradeAnswer('MULTIPLE_CHOICE', null, 'ஆ') === false, 'a missing payload always grades false')

// ---------------------------------------------------------------------
console.log('\n== 3. Question Set authoring limits, media URLs, in-place edits, abuse limits ==')
assert(isSafeMediaUrl('https://example.org/a.png'), 'https media URL is allowed')
assert(isSafeMediaUrl('/audio/amma.mp3'), 'root-relative media path is allowed')
assert(isSafeMediaUrl(''), 'an empty media URL (none) is allowed')
assert(!isSafeMediaUrl('javascript:alert(1)'), 'javascript: media URL is rejected')
assert(!isSafeMediaUrl('data:text/html,<script>1</script>'), 'data: media URL is rejected')
assert(!isSafeMediaUrl('//evil.example/x.png'), 'protocol-relative media URL is rejected')
assert(!isSafeMediaUrl(42), 'a non-string media URL is rejected')

const okSet = { title: 'திணை', description: null, tags: ['grammar'], questions: [{ questionType: 'MULTIPLE_CHOICE', prompt: 'x', payload: mc, points: 100 }] }
assert(validateQuestionSetLimits(okSet).length === 0, 'a normal question set passes every limit')
assert(
  validateQuestionSetLimits({ ...okSet, questions: Array.from({ length: QUESTION_SET_LIMITS.maxQuestions + 1 }, () => okSet.questions[0]) }).length > 0,
  `more than ${QUESTION_SET_LIMITS.maxQuestions} questions is rejected`
)
assert(
  validateQuestionSetLimits({ ...okSet, questions: [{ ...okSet.questions[0], payload: { options: ['x'.repeat(QUESTION_SET_LIMITS.maxPayloadBytes)], correctAnswer: 'x' } }] }).length > 0,
  'an oversized question payload is rejected'
)
assert(validateQuestionSetLimits({ ...okSet, questions: [{ ...okSet.questions[0], points: 1e9 }] }).length > 0, 'an absurd points value is rejected')
assert(validateQuestionSetLimits({ ...okSet, questions: [{ ...okSet.questions[0], points: 1.5 }] }).length > 0, 'a fractional points value is rejected')
assert(validateQuestionSetLimits({ ...okSet, questions: [{ ...okSet.questions[0], mediaUrl: 'javascript:x' }] }).length > 0, 'an unsafe question media URL is rejected')
assert(
  validateQuestionSetLimits({
    ...okSet,
    questions: [{ questionType: 'IMAGE_CHOICE', prompt: 'x', payload: { options: [{ imageUrl: 'javascript:x' }], correctAnswer: 'javascript:x' } }],
  }).length > 0,
  'an unsafe IMAGE_CHOICE option URL is rejected'
)
assert(
  validateQuestionSetLimits({ ...okSet, questions: [{ questionType: 'AUDIO_CHOICE', prompt: 'x', payload: { audioUrl: 'data:audio/x', options: ['a'], correctAnswer: 'a' } }] }).length > 0,
  'an unsafe AUDIO_CHOICE audio URL is rejected'
)
assert(validateQuestionSetLimits({ ...okSet, title: 'x'.repeat(QUESTION_SET_LIMITS.maxTitleLength + 1) }).length > 0, 'an overlong title is rejected')
assert(validateQuestionSetLimits({ ...okSet, tags: Array.from({ length: QUESTION_SET_LIMITS.maxTags + 1 }, (_, i) => `t${i}`) }).length > 0, 'too many tags is rejected')

const plan = planQuestionReplacement(['q1', 'q2', 'q3'], ['q2', undefined, 'q1', 'foreign-id', 'q2'])
assert(JSON.stringify(plan.updateIndexes) === JSON.stringify([0, 2]), 'questions whose ids belong to this set are updated in place (keeps their answers/analytics)')
assert(JSON.stringify(plan.insertIndexes) === JSON.stringify([1, 3, 4]), 'new questions, ids from other sets, and duplicate ids are all inserted fresh -- never trusted')
assert(JSON.stringify(plan.deleteIds) === JSON.stringify(['q3']), 'only the question the teacher removed is deleted')
const untouched = planQuestionReplacement(['a', 'b'], ['a', 'b'])
assert(untouched.deleteIds.length === 0 && untouched.insertIndexes.length === 0, 'resaving an unchanged set deletes nothing (previously: every save cascade-deleted all answers)')

assert(!exceedsSessionStartLimit(SESSION_START_LIMIT.maxStarts - 1), 'normal play is under the session-start limit')
assert(exceedsSessionStartLimit(SESSION_START_LIMIT.maxStarts), 'session-start spam hits the limit')
assert(studentMayControlPause(false) === true, 'a solo player can pause/resume their own game')
assert(studentMayControlPause(true) === false, 'a Live Classroom participant cannot self-pause/resume (the host controls pacing)')

// ---------------------------------------------------------------------
// Migration replay helpers
// ---------------------------------------------------------------------
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const v2Migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+_gameroom_v2_.*\.sql$/.test(f))
  .sort()
const migrationSql = v2Migrations.map((f) => ({ file: f, sql: stripSqlComments(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')) }))

// Removes `-- ...` line comments (these migrations use no block
// comments) while leaving `--` inside single-quoted string literals
// alone -- several COMMENT ON COLUMN strings contain " -- ". A doubled
// '' escape toggles the quote state twice, which nets out correctly.
function stripSqlComments(sql: string): string {
  let out = ''
  let inQuote = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (!inQuote && ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (ch === "'") inQuote = !inQuote
    out += ch
  }
  return out
}

interface Policy {
  table: string
  name: string
  command: string
  body: string
}

// Replays CREATE POLICY / DROP POLICY in migration order into the
// effective policy set as of the latest migration.
const policies = new Map<string, Policy>()
for (const { sql } of migrationSql) {
  const statements = sql.split(';')
  for (const stmt of statements) {
    const create = /CREATE POLICY\s+"([^"]+)"\s+ON\s+(\w+)\s+FOR\s+(\w+)([\s\S]*)$/i.exec(stmt)
    if (create) {
      policies.set(`${create[2]}::${create[1]}`, { table: create[2], name: create[1], command: create[3].toUpperCase(), body: create[4] })
      continue
    }
    const drop = /DROP POLICY\s+(?:IF EXISTS\s+)?"([^"]+)"\s+ON\s+(\w+)/i.exec(stmt)
    if (drop) policies.delete(`${drop[2]}::${drop[1]}`)
  }
}

function effectivePolicies(table: string): Policy[] {
  return Array.from(policies.values()).filter((p) => p.table === table)
}

function isAdminPolicy(p: Policy): boolean {
  return /: admin all$/.test(p.name) && /sms_current_role\(\)\s*=\s*'admin'/.test(p.body)
}

// Last CREATE [OR REPLACE] FUNCTION body for a name, across all V2 migrations.
function latestFunctionBody(name: string): string | null {
  let latest: string | null = null
  for (const { sql } of migrationSql) {
    const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(([\\s\\S]*?)\\$\\$([\\s\\S]*?)\\$\\$`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(sql)) !== null) latest = m[1] + m[2]
  }
  return latest
}

// Every SECURITY DEFINER function any V2 migration defines.
const definerFunctions = new Set<string>()
for (const { sql } of migrationSql) {
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)\s*\(([\s\S]*?)\$\$/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    if (/SECURITY\s+DEFINER/i.test(m[2])) definerFunctions.add(m[1])
  }
}

// Final EXECUTE state per (function, role), replaying REVOKE/GRANT in order.
// A role is considered able to execute unless the LAST statement touching
// it for that function was a REVOKE. PUBLIC starts granted (Postgres default).
type Grantee = 'public' | 'anon' | 'authenticated' | 'service_role'
const grantState = new Map<string, Map<Grantee, boolean>>()
for (const { sql } of migrationSql) {
  for (const stmt of sql.split(';')) {
    const m = /\b(REVOKE|GRANT)\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+(\w+)\s*\([^)]*\)\s+(FROM|TO)\s+([\w\s,]+)$/i.exec(stmt.trim())
    if (!m) continue
    const fn = m[2]
    const allow = m[1].toUpperCase() === 'GRANT'
    const roles = m[4].split(',').map((r) => r.trim().toLowerCase()).filter(Boolean) as Grantee[]
    if (!grantState.has(fn)) grantState.set(fn, new Map())
    for (const r of roles) grantState.get(fn)!.set(r, allow)
  }
}
function canExecute(fn: string, role: Grantee): boolean {
  const s = grantState.get(fn)
  const publicGranted = s?.get('public') ?? true
  const explicit = s?.get(role)
  if (explicit === true) return true
  // anon/authenticated inherit PUBLIC unless explicitly revoked. (Supabase
  // also grants them explicitly by default privileges, so an explicit
  // REVOKE for the role itself is required, not just PUBLIC.)
  if (explicit === false) return false
  if (role === 'anon' || role === 'authenticated') return true
  return publicGranted
}

// ---------------------------------------------------------------------
console.log('\n== 4. Effective RLS: server-owned tables are read-only to non-admins ==')
const SERVER_WRITTEN_TABLES = [
  'sms_gamev2_sessions',
  'sms_gamev2_answers',
  'sms_gamev2_learning_events',
  'sms_gamev2_skill_practice',
  'sms_gamev2_live_participants',
  'sms_gamev2_player_stats',
  'sms_gamev2_engine_mastery',
  'sms_gamev2_question_set_completions',
  'sms_gamev2_player_achievements',
  'sms_gamev2_daily_challenge_progress',
]
assert(v2Migrations.includes('083_gameroom_v2_security_hardening.sql'), 'migration 083 (security hardening) exists')
for (const table of SERVER_WRITTEN_TABLES) {
  const nonAdmin = effectivePolicies(table).filter((p) => !isAdminPolicy(p))
  const writable = nonAdmin.filter((p) => p.command !== 'SELECT')
  assert(
    writable.length === 0,
    `${table}: no non-admin INSERT/UPDATE/DELETE/ALL policy${writable.length ? ` (found: ${writable.map((p) => `"${p.name}" FOR ${p.command}`).join(', ')})` : ''}`
  )
  assert(nonAdmin.some((p) => p.command === 'SELECT'), `${table}: its owner can still READ their own rows`)
}

console.log('\n== 5. Effective RLS: answer keys and live-session rows ==')
const questionPolicies = effectivePolicies('sms_gamev2_questions').filter((p) => !isAdminPolicy(p))
assert(
  questionPolicies.every((p) => /sms_current_role\(\)\s*=\s*'teacher'|created_by\s*=\s*sms_current_user_id\(\)/.test(p.body)),
  'sms_gamev2_questions: every non-admin policy is teacher/owner-scoped -- no student/tester can SELECT answer keys'
)
assert(
  !questionPolicies.some((p) => /sms_gamev2_testers/.test(p.body)),
  'sms_gamev2_questions: the "tester read published set" answer-key leak is gone'
)
const publishedReadPolicies = effectivePolicies('sms_gamev2_question_sets').filter((p) => /published\s*=\s*true/.test(p.body))
assert(
  publishedReadPolicies.length > 0 &&
    publishedReadPolicies.every((p) => p.command === 'SELECT' && /sms_current_role\(\)\s*=\s*'student'/.test(p.body)),
  'sms_gamev2_question_sets: the read-published policy is SELECT-only and STUDENT-only (teachers cannot see other teachers\' PRIVATE sets)'
)
const livePolicies = effectivePolicies('sms_gamev2_live_sessions').filter((p) => !isAdminPolicy(p))
assert(
  livePolicies.every((p) => p.command === 'SELECT' || p.command === 'INSERT'),
  'sms_gamev2_live_sessions: nobody but admin can UPDATE/DELETE a live session row directly (lifecycle goes through the RPCs)'
)
const liveInsert = livePolicies.find((p) => p.command === 'INSERT')
assert(
  Boolean(liveInsert && /sms_teacher_owns_class/.test(liveInsert.body) && /status\s*=\s*'LOBBY'/.test(liveInsert.body)),
  'sms_gamev2_live_sessions: a host can only create a LOBBY session for a class they teach'
)
// 42P17 guard (found live in production, fixed in 086): a policy on one
// live table must never subquery either live table directly -- that
// re-enters RLS recursively. Cross-table checks go through the
// SECURITY DEFINER sms_gamev2_is_live_* helpers instead.
for (const table of ['sms_gamev2_live_sessions', 'sms_gamev2_live_participants']) {
  const recursive = effectivePolicies(table).filter((p) => /FROM\s+sms_gamev2_live_(sessions|participants)\b/i.test(p.body))
  assert(recursive.length === 0, `${table}: no policy subqueries a live table directly (no RLS infinite recursion)${recursive.length ? ` (found: ${recursive.map((p) => p.name).join(', ')})` : ''}`)
}
const participantInsertable = effectivePolicies('sms_gamev2_live_participants').filter((p) => !isAdminPolicy(p) && p.command !== 'SELECT')
assert(participantInsertable.length === 0, 'sms_gamev2_live_participants: a student cannot insert themselves into a live session (join route is the only path)')

// ---------------------------------------------------------------------
console.log('\n== 6. SECURITY DEFINER functions: grants and caller checks ==')
const REWARD_RPCS = ['sms_gamev2_apply_session_rewards', 'sms_gamev2_apply_progression', 'sms_gamev2_apply_daily_challenge_progress']
for (const fn of REWARD_RPCS) {
  assert(definerFunctions.has(fn), `${fn} is a known SECURITY DEFINER function`)
  assert(!canExecute(fn, 'anon'), `${fn}: anon cannot execute`)
  assert(!canExecute(fn, 'authenticated'), `${fn}: authenticated (any logged-in student) cannot execute -- no more self-granted XP/coins/achievements`)
  assert(canExecute(fn, 'service_role'), `${fn}: service_role (the server-only reward service) can execute`)
}

// Every other definer function must check who is calling. A new one that
// neither checks the caller nor is locked to service_role fails here.
const READ_ONLY_AGGREGATE_ALLOWLIST = new Set(['sms_gamev2_question_set_usage_count', 'sms_gamev2_question_set_usage_counts'])
for (const fn of Array.from(definerFunctions)) {
  if (REWARD_RPCS.includes(fn) || READ_ONLY_AGGREGATE_ALLOWLIST.has(fn)) continue
  const body = latestFunctionBody(fn) ?? ''
  assert(/sms_current_user_id\(\)/.test(body), `${fn}: latest definition checks the caller's identity`)
  assert(!canExecute(fn, 'anon'), `${fn}: anon cannot execute`)
}
for (const fn of Array.from(READ_ONLY_AGGREGATE_ALLOWLIST)) {
  assert(definerFunctions.has(fn), `${fn} is a known SECURITY DEFINER function`)
  assert(!canExecute(fn, 'anon'), `${fn}: anon cannot execute`)
}

const resolveBody = latestFunctionBody('sms_gamev2_resolve_live_session_by_join_code') ?? ''
assert(
  /s\.id\s*=\s*p_student_id\s+AND\s+s\.profile_id\s*=\s*sms_current_user_id\(\)/.test(resolveBody),
  'join-code resolver: the caller must BE p_student_id (no probing other students\' enrollment)'
)
assert(
  !/v_enrolled/.test(resolveBody) && /sms_class_enrollments[\s\S]*?RETURN;/.test(resolveBody),
  'join-code resolver: a non-enrolled caller gets no row at all (no live_session_id leak)'
)
const startBody = latestFunctionBody('sms_gamev2_start_live_session') ?? ''
assert(
  /q\.question_set_id\s*=\s*v_live\.question_set_id/.test(startBody),
  'start_live_session: rejects a question order containing questions from another set'
)

// ---------------------------------------------------------------------
console.log('\n== 7. Route source: writes go through the server-only admin client ==')
function walk(dir: string): string[] {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return []
  const out: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(rel))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel)
  }
  return out
}
const v2Sources = [...walk('app/api/gameroom-v2'), ...walk('lib/gameRoomV2'), ...walk('app/gameroom-v2'), ...walk('components/gameRoomV2')]
const tableAlternation = SERVER_WRITTEN_TABLES.join('|')
// `<client>.from('<server-owned table>')...<write>(` where <client> is a
// user-scoped client and no other statement intervenes.
const userWriteRe = new RegExp(
  `\\b(supabase|access\\.supabase|guard\\.supabase)\\s*\\.from\\('(${tableAlternation})'\\)((?:(?!await|\\bconst\\b|\\blet\\b|;)[\\s\\S]){0,300}?)\\.(insert|update|upsert|delete)\\(`,
  'g'
)
let userWrites = 0
for (const file of v2Sources) {
  const src = readFileSync(join(ROOT, file), 'utf8')
  let m: RegExpExecArray | null
  userWriteRe.lastIndex = 0
  while ((m = userWriteRe.exec(src)) !== null) {
    userWrites++
    console.error(`  FAIL: ${file} writes ${m[2]} through the caller's RLS client (${m[1]}) -- use the admin client, scoped to the caller`)
    failures++
  }
  if (/\b(supabase|access\.supabase)\.rpc\('sms_gamev2_apply_/.test(src)) {
    console.error(`  FAIL: ${file} calls a reward RPC through the caller's client -- only rewardService.ts (via admin) may`)
    failures++
  }
}
assert(userWrites === 0, 'no V2 file writes a server-owned table through a user-scoped client')

const rewardService = readFileSync(join(ROOT, 'lib/gameRoomV2/rewards/rewardService.ts'), 'utf8')
for (const fn of REWARD_RPCS) {
  assert(new RegExp(`admin\\.rpc\\('${fn}'`).test(rewardService), `rewardService.ts calls ${fn} through the admin client`)
}
const adminImporters = v2Sources.filter((f) => /from '@\/lib\/supabase\/admin'/.test(readFileSync(join(ROOT, f), 'utf8')))
assert(
  adminImporters.every((f) => f.startsWith('app/api/gameroom-v2') || f.startsWith('app\\api\\gameroom-v2') || /lib[\\/]gameRoomV2/.test(f)),
  'the service-role client is only imported by API routes / server lib code, never by pages or components'
)
assert(
  adminImporters.every((f) => {
    if (!/lib[\\/]gameRoomV2/.test(f)) return true
    return /^import 'server-only'/m.test(readFileSync(join(ROOT, f), 'utf8'))
  }),
  'every lib/gameRoomV2 module importing the admin client is marked server-only'
)

const completeRoute = readFileSync(join(ROOT, 'app/api/gameroom-v2/sessions/[id]/complete/route.ts'), 'utf8')
assert(
  /\.is\('rewards_finalized_at', null\)/.test(completeRoute) && completeRoute.indexOf(".is('rewards_finalized_at', null)") < completeRoute.indexOf('finalizeSessionRewards({'),
  '/complete atomically claims rewards_finalized_at BEFORE granting anything (no double-grant race)'
)
const answerRoute = readFileSync(join(ROOT, 'app/api/gameroom-v2/sessions/[id]/answer/route.ts'), 'utf8')
assert(/\.eq\('current_index', questionIndex\)/.test(answerRoute), '/answer advances the session with a compare-and-set on current_index')
assert(/checkSubmittedAnswer\(/.test(answerRoute), '/answer size-caps the submitted answer before storing it')

const studentRoutes = walk('app/api/gameroom-v2').filter((f) => /from '@\/lib\/require-student'/.test(readFileSync(join(ROOT, f), 'utf8')))
assert(studentRoutes.length === 0, `no V2 route bypasses the tester allowlist with plain requireStudent()${studentRoutes.length ? ` (found: ${studentRoutes.join(', ')})` : ''}`)
for (const f of ['lib/gameRoomV2/requireSession.ts', 'lib/gameRoomV2/liveClassroom/requireLiveSession.ts']) {
  assert(/requireGameV2Student\(\)/.test(readFileSync(join(ROOT, f), 'utf8')), `${f} gates students on the V2 tester allowlist`)
}
for (const f of ['app/api/gameroom-v2/sessions/[id]/pause/route.ts', 'app/api/gameroom-v2/sessions/[id]/resume/route.ts']) {
  assert(/studentMayControlPause\(/.test(readFileSync(join(ROOT, f), 'utf8')), `${f} refuses self-pause/resume for Live Classroom sessions`)
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
