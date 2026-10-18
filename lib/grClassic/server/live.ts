import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CONNECTED_MS, canAnswerLive, isExpired, isRace, makePin, nextStep, nicknameFor, playerBoard, rankPlayers, RACE_POINTS_PER_UNIT, type HostState, type LiveStatus, type PlayerState } from '../live'
import { checkResponse, toPlayQuestion, type CheckResult, type PlayQuestion, type PlayResponse } from '../play'
import { livePoints } from '../scoring'
import type { Game, Question } from '../types'
import { GrcError } from './studentAssignments'

// Live games. Teachers act through their own RLS-scoped client (they may
// only touch sessions they host, for classes they teach). Students never
// touch the sms_grc_live_* tables directly: their routes use the
// service-role client, scoped explicitly to the signed-in student (their
// player row is found by their own profile id). Answer keys stay here.

const SESSION_COLUMNS = 'id, owner_id, class_id, title, game_type, pin, status, current_index, question_started_at, question_ends_at, live_seconds, question_count, updated_at'

interface SessionRow {
  id: string
  owner_id: string
  class_id: string
  title: string
  game_type: Game['type']
  pin: string
  status: LiveStatus
  current_index: number
  question_started_at: string | null
  question_ends_at: string | null
  live_seconds: number
  question_count: number
  updated_at: string
}

interface PlayerRow {
  student_id: string
  nickname: string
  finished_at: string | null
  last_seen_at: string
}

interface AnswerRow {
  student_id: string
  question_id: string
  response: Record<string, unknown>
  correct_units: number
  total_units: number
  points: number
  done: boolean
}

const effectiveStatus = (s: SessionRow): LiveStatus => (s.status !== 'ended' && isExpired(s.updated_at) ? 'ended' : s.status)

// ---------- Teacher ----------

// The teacher's unfinished live game for this game + class, or a new one.
// Re-opening the host page therefore returns to the same game and PIN.
export async function hostSession(supabase: SupabaseClient, game: Game, classId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('sms_grc_live_sessions')
    .select(SESSION_COLUMNS)
    .eq('game_id', game.id)
    .eq('class_id', classId)
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)
  const open = (existing as SessionRow[] | null)?.[0]
  if (open && !isExpired(open.updated_at)) return open.id
  return createLiveSession(supabase, { gameId: game.id, title: game.title, type: game.type, liveSeconds: game.liveSeconds, questions: game.questions }, classId)
}

// A new live game with its own frozen copy of the questions. gameId is
// null for a game played straight from a topic of the question library.
export async function createLiveSession(supabase: SupabaseClient, g: { gameId: string | null; title: string; type: Game['type']; liveSeconds: number; questions: Question[] }, classId: string): Promise<string> {
  const questions = g.questions
  const play: PlayQuestion[] = questions.map(toPlayQuestion)
  for (let tries = 0; tries < 6; tries++) {
    const { data, error } = await supabase.rpc('sms_grc_create_live_session', {
      p_game_id: g.gameId,
      p_class_id: classId,
      p_title: g.title.slice(0, 120),
      p_game_type: g.type,
      p_pin: makePin(),
      p_live_seconds: g.liveSeconds,
      p_questions: questions,
      p_play: play,
      p_question_count: questions.length,
    })
    if (!error) return data as string
    if (error.code !== '23505') throw error // 23505 = that PIN is in use; pick another
  }
  throw new GrcError('Could not create a game PIN. Please try again.', 503)
}

export async function hostState(supabase: SupabaseClient, sessionId: string): Promise<HostState | null> {
  const { data } = await supabase.from('sms_grc_live_sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle()
  if (!data) return null
  const s = data as SessionRow
  const [{ data: content }, { data: players }, { data: answers }, { data: cls }] = await Promise.all([
    supabase.from('sms_grc_live_content').select('questions, play').eq('session_id', sessionId).single(),
    supabase.from('sms_grc_live_players').select('student_id, nickname, finished_at, last_seen_at').eq('session_id', sessionId).order('joined_at'),
    supabase.from('sms_grc_live_answers').select('student_id, question_id, response, correct_units, total_units, points, done').eq('session_id', sessionId),
    supabase.from('sms_classes').select('name').eq('id', s.class_id).maybeSingle(),
  ])
  const c = content as { questions: Question[]; play: PlayQuestion[] }
  const ps = (players ?? []) as PlayerRow[]
  const as = (answers ?? []) as AnswerRow[]
  const status = effectiveStatus(s)
  const race = isRace(s.game_type)
  const now = Date.now()
  const currentId = !race && s.current_index >= 0 ? c.play[s.current_index]?.id : undefined
  const question = currentId ? (c.questions.find((q) => q.id === currentId) ?? null) : null
  const current = currentId ? as.filter((a) => a.question_id === currentId) : []
  const showDistribution = question?.kind === 'choice' && (status === 'reveal' || status === 'leaderboard')
  const standings = rankPlayers(ps, as, race)
  return {
    id: s.id,
    title: s.title,
    type: s.game_type,
    pin: s.pin,
    className: (cls as { name: string } | null)?.name ?? 'Class',
    status,
    index: s.current_index,
    count: s.question_count,
    liveSeconds: s.live_seconds,
    serverNow: new Date(now).toISOString(),
    endsAt: s.question_ends_at,
    players: ps.map((p) => ({ studentId: p.student_id, nickname: p.nickname, connected: now - new Date(p.last_seen_at).getTime() < CONNECTED_MS })),
    question,
    answered: current.length,
    distribution: showDistribution && question?.kind === 'choice' ? question.options.map((_, i) => current.filter((a) => a.response.choice === i).length) : null,
    standings,
    gained: Object.fromEntries(current.map((a) => [a.student_id, a.points])),
    race: race
      ? standings.map((st) => {
          const p = ps.find((x) => x.student_id === st.studentId)!
          return { studentId: st.studentId, nickname: st.nickname, done: as.filter((a) => a.student_id === st.studentId && a.done).length, score: st.score, finished: Boolean(p.finished_at) }
        })
      : null,
  }
}

export type HostAction = 'next' | 'end' | 'again'

// The teacher presses Next / End / Play again. `expect` is the step the
// teacher's screen was showing, so a double click never skips a question.
export async function hostAction(supabase: SupabaseClient, admin: SupabaseClient, sessionId: string, action: HostAction, expect: { status: LiveStatus; index: number }): Promise<void> {
  const { data } = await supabase.from('sms_grc_live_sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle()
  if (!data) throw new GrcError('Live game not found.', 404)
  const s = data as SessionRow
  if (s.status !== expect.status || s.current_index !== expect.index) return // someone already moved on
  const now = new Date()
  let changes: Record<string, unknown>
  if (action === 'end') {
    if (s.status === 'ended') return
    changes = { status: 'ended', ended_at: now.toISOString() }
  } else if (action === 'again') {
    if (s.status !== 'ended') throw new GrcError('The game is still running.', 409)
    // Clear the old answers (server only), then reopen the lobby.
    const { error: delError } = await admin.from('sms_grc_live_answers').delete().eq('session_id', sessionId)
    if (delError) throw delError
    await admin.from('sms_grc_live_players').update({ finished_at: null }).eq('session_id', sessionId)
    changes = { status: 'lobby', current_index: -1, question_started_at: null, question_ends_at: null, ended_at: null }
  } else {
    const step = nextStep(s.game_type, s.status, s.current_index, s.question_count)
    if (!step) return
    changes = { status: step.status, current_index: step.index }
    if (step.status === 'question') {
      changes.question_started_at = now.toISOString()
      changes.question_ends_at = new Date(now.getTime() + s.live_seconds * 1000).toISOString()
    }
    if (step.status === 'ended') changes.ended_at = now.toISOString()
  }
  let { error } = await supabase.from('sms_grc_live_sessions').update(changes).eq('id', sessionId).eq('status', s.status).eq('current_index', s.current_index)
  // Re-opening: the old PIN may now belong to another game.
  if (error?.code === '23505' && action === 'again') ({ error } = await supabase.from('sms_grc_live_sessions').update({ ...changes, pin: makePin() }).eq('id', sessionId).eq('status', s.status))
  if (error) throw error
}

// ---------- Students ----------

async function sessionByPin(admin: SupabaseClient, pin: string): Promise<SessionRow | null> {
  const { data } = await admin.from('sms_grc_live_sessions').select(SESSION_COLUMNS).eq('pin', pin).neq('status', 'ended').maybeSingle()
  const s = data as SessionRow | null
  return s && !isExpired(s.updated_at) ? s : null
}

// Join with a PIN. Only students actively enrolled in the hosting class
// may join. Joining again (refresh, new phone) returns the same player.
export async function joinLive(admin: SupabaseClient, student: { id: string; profileId: string; firstName: string; lastName: string }, pin: string): Promise<{ sessionId: string }> {
  const s = await sessionByPin(admin, pin)
  if (!s) throw new GrcError('We couldn’t find a live game with that PIN. Check the big screen and try again.', 404)
  const { data: enrolled } = await admin.from('sms_class_enrollments').select('student_id').eq('class_id', s.class_id).eq('student_id', student.id).eq('status', 'active').maybeSingle()
  if (!enrolled) throw new GrcError('This live game is for another class.', 403)
  const { data: me } = await admin.from('sms_grc_live_players').select('student_id').eq('session_id', s.id).eq('student_id', student.id).maybeSingle()
  if (!me) {
    const { data: others } = await admin.from('sms_grc_live_players').select('nickname').eq('session_id', s.id)
    const nickname = nicknameFor(student.firstName, student.lastName, ((others ?? []) as { nickname: string }[]).map((o) => o.nickname))
    const { error } = await admin.from('sms_grc_live_players').insert({ session_id: s.id, student_id: student.id, profile_id: student.profileId, nickname })
    if (error && error.code !== '23505') throw error
  } else {
    await admin.from('sms_grc_live_players').update({ last_seen_at: new Date().toISOString() }).eq('session_id', s.id).eq('student_id', student.id)
  }
  return { sessionId: s.id }
}

async function playerContext(admin: SupabaseClient, sessionId: string, profileId: string) {
  const [{ data: sData }, { data: pData }] = await Promise.all([
    admin.from('sms_grc_live_sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle(),
    admin.from('sms_grc_live_players').select('student_id, nickname, finished_at, last_seen_at').eq('session_id', sessionId).eq('profile_id', profileId).maybeSingle(),
  ])
  if (!sData || !pData) throw new GrcError('Join the game with its PIN first.', 403)
  return { s: sData as SessionRow, me: pData as PlayerRow }
}

export async function playerState(admin: SupabaseClient, sessionId: string, profileId: string): Promise<PlayerState> {
  const { s, me } = await playerContext(admin, sessionId, profileId)
  const now = Date.now()
  if (now - new Date(me.last_seen_at).getTime() > 8000) await admin.from('sms_grc_live_players').update({ last_seen_at: new Date(now).toISOString() }).eq('session_id', sessionId).eq('student_id', me.student_id)

  const [{ data: content }, { data: players }, { data: answers }] = await Promise.all([
    admin.from('sms_grc_live_content').select('questions, play').eq('session_id', sessionId).single(),
    admin.from('sms_grc_live_players').select('student_id, nickname, finished_at, last_seen_at').eq('session_id', sessionId),
    admin.from('sms_grc_live_answers').select('student_id, question_id, response, correct_units, total_units, points, done').eq('session_id', sessionId),
  ])
  const c = content as { questions: Question[]; play: PlayQuestion[] }
  const ps = (players ?? []) as PlayerRow[]
  const as = (answers ?? []) as AnswerRow[]
  const status = effectiveStatus(s)
  const race = isRace(s.game_type)
  const revealed = status === 'reveal' || status === 'leaderboard' || status === 'ended'
  const current = !race && s.current_index >= 0 && status !== 'lobby' ? c.play[s.current_index] : null
  // While a question is open, scores leave it out: a jump straight after
  // answering would give away whether the answer was right.
  const standings = rankPlayers(ps, status === 'question' && current ? as.filter((a) => a.question_id !== current.id) : as, race)
  const mine = standings.find((x) => x.studentId === me.student_id)
  const myAnswer = current ? as.find((a) => a.student_id === me.student_id && a.question_id === current.id) : undefined
  const fullCurrent = current ? c.questions.find((q) => q.id === current.id) : undefined

  return {
    title: s.title,
    type: s.game_type,
    status,
    index: s.current_index,
    count: s.question_count,
    serverNow: new Date(now).toISOString(),
    endsAt: s.question_ends_at,
    nickname: me.nickname,
    playersCount: ps.length,
    question: status === 'question' || revealed ? current : null,
    questions: race && status === 'race' ? c.play : null,
    doneIds: race ? as.filter((a) => a.student_id === me.student_id && a.done).map((a) => a.question_id) : [],
    myAnswer: current
      ? myAnswer
        ? { choice: typeof myAnswer.response.choice === 'number' ? (myAnswer.response.choice as number) : null, correct: revealed ? myAnswer.correct_units >= myAnswer.total_units : null, points: revealed ? myAnswer.points : null }
        : { choice: null, correct: null, points: null }
      : null,
    // The right option only once the teacher has revealed it.
    correctIndex: revealed && fullCurrent?.kind === 'choice' ? fullCurrent.answerIndex : null,
    score: mine?.score ?? 0,
    rank: status === 'leaderboard' || status === 'ended' || race ? (mine?.rank ?? null) : null,
    podium: status === 'ended' ? standings.slice(0, 3) : null,
    leaderboard:
      status === 'leaderboard' || status === 'ended' || (race && status === 'race')
        ? playerBoard(standings, me.student_id, status === 'leaderboard' && current ? Object.fromEntries(as.filter((a) => a.question_id === current.id).map((a) => [a.student_id, a.points])) : {})
        : null,
  }
}

// One answer. Quiz: the choice for the current question, before time is up
// (points for speed, shown after the reveal). Race: like an assignment --
// first answer counts, matching checked pair by pair.
export async function answerLive(admin: SupabaseClient, sessionId: string, profileId: string, questionId: string, response: PlayResponse): Promise<CheckResult | { received: true }> {
  const { s, me } = await playerContext(admin, sessionId, profileId)
  const race = isRace(s.game_type)
  if (!canAnswerLive({ status: effectiveStatus(s), question_ends_at: s.question_ends_at }, race)) throw new GrcError(race ? 'The game is not running right now.' : 'Too late — time is up for this question.', 409)
  const { data: content } = await admin.from('sms_grc_live_content').select('questions, play').eq('session_id', sessionId).single()
  const c = content as { questions: Question[]; play: PlayQuestion[] }
  const question = c.questions.find((q) => q.id === questionId)
  if (!question) throw new GrcError('Question not found.', 404)

  const { data: existing } = await admin.from('sms_grc_live_answers').select('student_id, question_id, response, correct_units, total_units, points, done').eq('session_id', sessionId).eq('student_id', me.student_id).eq('question_id', questionId).maybeSingle()
  const prev = existing as AnswerRow | null

  if (!race) {
    if (c.play[s.current_index]?.id !== questionId) throw new GrcError('That question is over.', 409)
    if (response.kind !== 'choice') throw new GrcError('Invalid answer.', 400)
    if (prev) return { received: true }
    const correct = checkResponse(question, response, false).correct
    const points = livePoints(correct, Date.now() - new Date(s.question_started_at!).getTime(), s.live_seconds * 1000)
    const { error } = await admin.from('sms_grc_live_answers').upsert(
      { session_id: sessionId, student_id: me.student_id, question_id: questionId, response, correct_units: correct ? 1 : 0, total_units: 1, points },
      { onConflict: 'session_id,student_id,question_id', ignoreDuplicates: true }
    )
    if (error) throw error
    return { received: true }
  }

  let result: CheckResult
  if (question.kind === 'match') {
    if (response.kind !== 'match' || !Number.isInteger(response.left) || !question.pairs[response.left]) throw new GrcError('Invalid answer.', 400)
    const picks = { ...((prev?.response.picks as Record<string, string>) ?? {}) }
    const matched = new Set((prev?.response.matched as number[]) ?? [])
    const correct = question.pairs[response.left].right === response.right
    if (picks[response.left] === undefined) picks[response.left] = response.right
    if (correct) matched.add(response.left)
    const firstRight = question.pairs.filter((p, i) => picks[i] === p.right).length
    const { error } = await admin.from('sms_grc_live_answers').upsert({
      session_id: sessionId,
      student_id: me.student_id,
      question_id: questionId,
      response: { picks, matched: Array.from(matched) },
      correct_units: firstRight,
      total_units: question.pairs.length,
      points: firstRight * RACE_POINTS_PER_UNIT,
      done: matched.size === question.pairs.length,
    })
    if (error) throw error
    result = { correct }
  } else {
    if (prev) return { correct: prev.correct_units >= prev.total_units }
    const correct = checkResponse(question, response, false).correct
    const { error } = await admin.from('sms_grc_live_answers').upsert(
      { session_id: sessionId, student_id: me.student_id, question_id: questionId, response, correct_units: correct ? 1 : 0, total_units: 1, points: correct ? RACE_POINTS_PER_UNIT : 0 },
      { onConflict: 'session_id,student_id,question_id', ignoreDuplicates: true }
    )
    if (error) throw error
    result = { correct }
  }

  // Finished every question? Record when, for the finishing bonus.
  if (!me.finished_at) {
    const { count } = await admin.from('sms_grc_live_answers').select('question_id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('student_id', me.student_id).eq('done', true)
    if ((count ?? 0) >= c.play.length) await admin.from('sms_grc_live_players').update({ finished_at: new Date().toISOString() }).eq('session_id', sessionId).eq('student_id', me.student_id).is('finished_at', null)
  }
  return result
}
