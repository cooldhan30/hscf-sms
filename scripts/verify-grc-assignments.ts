// GameRoom Classic Phase 4: assignment rules (lib/grClassic/assignments.ts).
// Run with: npx tsx scripts/verify-grc-assignments.ts
import { answersNote, answersVisible, attemptLimit, attemptsLeft, canAnswer, canStart, countedAttempt, percentOf, studentStatus, unitsOf, validateAssignment, validateSettingsPatch, type AssignmentLike, type AttemptLike } from '../lib/grClassic/assignments'
import { LIBRARY } from '../lib/grClassic/sampleData'

let failures = 0
let passes = 0
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++
  else {
    failures++
    console.error(`FAIL ${name}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`)
  }
}

const NOW = new Date('2026-10-13T12:00:00Z').getTime()
const iso = (hours: number) => new Date(NOW + hours * 3600_000).toISOString()
const A = (o: Partial<AssignmentLike> = {}): AssignmentLike => ({ due_at: iso(48), status: 'open', allow_late: false, max_attempts: 2, score_policy: 'best', show_answers: 'after-due', ...o })
const done = (no: number, percent: number, hoursAgo: number): AttemptLike => ({ status: 'submitted', attempt_no: no, percent, submitted_at: iso(-hoursAgo) })
const open = (no: number, deadline?: string): AttemptLike => ({ status: 'in_progress', attempt_no: no, percent: null, submitted_at: null, deadline_at: deadline ?? null })

// --- Which attempt counts ---
eq('best counts the highest', countedAttempt([done(1, 60, 5), done(2, 90, 3), done(3, 70, 1)], 'best')?.attempt_no, 2)
eq('best tie keeps the earliest', countedAttempt([done(1, 80, 5), done(2, 80, 3)], 'best')?.attempt_no, 1)
eq('latest counts the last', countedAttempt([done(1, 90, 5), done(2, 40, 1)], 'latest')?.attempt_no, 2)
eq('unfinished attempts never count', countedAttempt([open(1)], 'best'), null)

// --- Status shown to the student ---
eq('todo', studentStatus(A(), [], NOW), 'todo')
eq('in progress', studentStatus(A(), [open(1)], NOW), 'in-progress')
eq('submitted wins', studentStatus(A({ due_at: iso(-1) }), [done(1, 50, 2)], NOW), 'submitted')
eq('overdue', studentStatus(A({ due_at: iso(-1) }), [], NOW), 'overdue')
eq('closed and not done = overdue', studentStatus(A({ status: 'closed' }), [open(1)], NOW), 'overdue')

// --- Starting ---
eq('can start', canStart(A(), [], 0, NOW), { ok: true })
eq('resume allowed even with no attempts left', canStart(A({ max_attempts: 1 }), [open(1)], 0, NOW), { ok: true })
eq('no attempts left', canStart(A({ max_attempts: 2 }), [done(1, 50, 2), done(2, 60, 1)], 0, NOW).ok, false)
eq('extra attempt granted', canStart(A({ max_attempts: 2 }), [done(1, 50, 2), done(2, 60, 1)], 1, NOW), { ok: true })
eq('unlimited', canStart(A({ max_attempts: null }), Array.from({ length: 9 }, (_, i) => done(i + 1, 50, 9 - i)), 0, NOW), { ok: true })
eq('closed', canStart(A({ status: 'closed' }), [], 0, NOW), { ok: false, reason: 'Your teacher has closed this assignment.' })
eq('past due, no late work', canStart(A({ due_at: iso(-1) }), [], 0, NOW).ok, false)
eq('past due, late work allowed', canStart(A({ due_at: iso(-1), allow_late: true }), [], 0, NOW), { ok: true })

// --- Answering ---
eq('can answer', canAnswer(A(), open(1), NOW), { ok: true })
eq('submitted attempt is final', canAnswer(A(), done(1, 50, 1), NOW).ok, false)
eq('timer ran out', canAnswer(A(), open(1, iso(-0.01)), NOW), { ok: false, reason: 'Time is up.' })
eq('timer still running', canAnswer(A(), open(1, iso(0.5)), NOW), { ok: true })
eq('closed mid-attempt', canAnswer(A({ status: 'closed' }), open(1), NOW).ok, false)

// --- Attempts left ---
eq('limit + extra', attemptLimit(2, 1), 3)
eq('unlimited limit', attemptLimit(null, 3), null)
eq('left', attemptsLeft(A({ max_attempts: 3 }), 1, 0), 2)
eq('never negative', attemptsLeft(A({ max_attempts: 1 }), 4, 0), 0)

// --- When answers show ---
eq('after due: not before', answersVisible(A(), true, NOW), false)
eq('after due: after', answersVisible(A({ due_at: iso(-1) }), true, NOW), true)
eq('after submit', answersVisible(A({ show_answers: 'after-submit' }), true, NOW), true)
eq('never', answersVisible(A({ show_answers: 'never', due_at: iso(-1) }), true, NOW), false)
eq('not submitted: never', answersVisible(A({ show_answers: 'after-submit' }), false, NOW), false)
eq('note before due', answersNote(A(), NOW), 'The right answers appear after the due date.')

// --- Grading units ---
eq('quiz = 1', unitsOf(LIBRARY.find((q) => q.kind === 'choice')!), 1)
eq('match = pairs', unitsOf(LIBRARY.find((q) => q.id === 'q-porul-1')!), 4)
eq('percent rounds', [percentOf(2, 3), percentOf(0, 5), percentOf(5, 5), percentOf(0, 0)], [67, 0, 100, 0])

// --- Teacher input ---
const gid = '11111111-1111-4111-8111-111111111111'
const cid = '22222222-2222-4222-8222-222222222222'
const v = validateAssignment({ gameId: gid, classIds: [cid, cid], dueAt: iso(24) }, NOW)
eq('defaults', v.ok && v.value.settings, { maxAttempts: 2, timerMinutes: null, passingPercent: null, randomize: true, allowLate: false, showAnswers: 'after-due', scorePolicy: 'best' })
eq('classes de-duplicated', v.ok && v.value.classIds, [cid])
const bad = validateAssignment({ gameId: 'x', classIds: [], dueAt: iso(-1), settings: { maxAttempts: 99, showAnswers: 'sometimes' } }, NOW)
eq('rejects bad input', bad.ok ? [] : bad.errors, ['Choose a game to assign.', 'Pick at least one class.', 'Pick a due date in the future.', 'Attempts is not a valid choice.', 'Show answers is not a valid choice.'])
// From a topic: no game needed, and none is recorded.
const fromTopic = validateAssignment({ classIds: [cid], dueAt: iso(24) }, NOW, true)
eq('topic assignment needs no game', fromTopic.ok && fromTopic.value.gameId, null)
eq('a game assignment still needs a game', validateAssignment({ classIds: [cid], dueAt: iso(24) }, NOW).ok, false)
eq('due date too far', validateAssignment({ gameId: gid, classIds: [cid], dueAt: iso(24 * 400) }, NOW).ok, false)
eq('all settings accepted', validateAssignment({ gameId: gid, classIds: [cid], dueAt: iso(24), settings: { maxAttempts: null, timerMinutes: 20, passingPercent: 70, randomize: false, allowLate: true, showAnswers: 'never', scorePolicy: 'latest' } }, NOW).ok, true)

// --- Changing settings after publishing ---
eq('settings patch maps to columns', validateSettingsPatch({ maxAttempts: null, timerMinutes: 20, scorePolicy: 'latest', allowLate: true }), { ok: true, columns: { max_attempts: null, timer_minutes: 20, allow_late: true, score_policy: 'latest' } })
eq('settings patch only sent fields', validateSettingsPatch({ showAnswers: 'never' }), { ok: true, columns: { show_answers: 'never' } })
eq('settings patch rejects bad values', validateSettingsPatch({ maxAttempts: 7, timerMinutes: 15, randomize: 'yes' }).ok, false)
eq('settings patch ignores unknown keys', validateSettingsPatch({ owner_id: 'x', status: 'open' }), { ok: true, columns: {} })

console.log(failures ? `\n${failures} FAILURE(S), ${passes} passed` : `\nPASS: ${passes} checks.`)
process.exit(failures ? 1 : 0)
