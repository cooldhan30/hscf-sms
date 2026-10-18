// In-browser stand-in for the live-game API (development harness only).
// It reuses the real rule functions (lib/grClassic/live, play, scoring)
// and simulates a class: classmates join, answer at random times, and --
// with ?auto=1 -- a "teacher" presses Next on a timer, so a student's
// phone can be watched through a whole game. It mimics the API's shape
// only; the real server also checks enrollment, PINs and the clock.
// ?switch=1: once the first question opens, the browser "is signed in as
// someone else" -- the game tab must stop instead of playing as them.
import { LIVE_ROSTER, gameById } from '@/lib/grClassic/sampleData'
import { checkResponse, toPlayQuestion } from '@/lib/grClassic/play'
import { livePoints } from '@/lib/grClassic/scoring'
import { isRace, nextStep, rankPlayers, PLAYER_HEADER, RACE_POINTS_PER_UNIT, WRONG_ACCOUNT, type HostState, type LiveStatus, type PlayerState } from '@/lib/grClassic/live'

type Ans = { student_id: string; question_id: string; points: number; correct: boolean; done: boolean; choice: number | null }

export function liveStandIn(params: URLSearchParams) {
  const game = gameById(params.get('game') ?? 'g-uyir-quiz')!
  const race = isRace(game.type)
  const play = game.questions.map(toPlayQuestion)
  const SECONDS = 8
  const s = { status: 'lobby' as LiveStatus, index: -1, startedAt: 0, endsAt: 0, enteredAt: Date.now() }
  const players: { student_id: string; nickname: string; finished_at: string | null; seen: number }[] = []
  const answers: Ans[] = []
  const ME = 'me'

  const now = () => Date.now()
  const addPlayer = (id: string, nickname: string) => players.push({ student_id: id, nickname, finished_at: null, seen: now() })

  // Classmates join one by one while in the lobby.
  setInterval(() => {
    if (s.status === 'lobby' && players.filter((p) => p.student_id !== ME).length < 8) {
      const n = players.filter((p) => p.student_id !== ME).length
      addPlayer(`s${n}`, LIVE_ROSTER[n])
    }
  }, 500)

  const go = (to: { status: LiveStatus; index: number }) => {
    s.status = to.status
    s.index = to.index
    s.enteredAt = now()
    if (to.status === 'question') {
      s.startedAt = now()
      s.endsAt = now() + SECONDS * 1000
      // Classmates answer at random times, mostly right.
      const q = game.questions[to.index]
      if (q.kind === 'choice')
        players
          .filter((p) => p.student_id !== ME)
          .forEach((p) => {
            const at = 800 + Math.random() * (SECONDS * 1000 - 2500)
            setTimeout(() => {
              if (s.status !== 'question' || s.index !== to.index) return
              const choice = Math.random() < 0.7 ? q.answerIndex : Math.floor(Math.random() * q.options.length)
              answers.push({ student_id: p.student_id, question_id: q.id, choice, correct: choice === q.answerIndex, points: livePoints(choice === q.answerIndex, at, SECONDS * 1000), done: true })
            }, at)
          })
    }
    if (to.status === 'race') {
      // Classmates work through the boards at their own pace.
      players
        .filter((p) => p.student_id !== ME)
        .forEach((p) =>
          game.questions.forEach((q, k) =>
            setTimeout(() => {
              if (s.status !== 'race') return
              const units = q.kind === 'match' ? q.pairs.length - (Math.random() < 0.4 ? 2 : 0) : 1
              answers.push({ student_id: p.student_id, question_id: q.id, choice: null, correct: true, points: units * RACE_POINTS_PER_UNIT, done: true })
              if (k === game.questions.length - 1) p.finished_at = new Date().toISOString()
            }, 1500 + k * (1500 + Math.random() * 2500))
          )
        )
    }
  }

  // ?auto=1: an automatic "teacher" moves the game along.
  if (params.get('auto') === '1') {
    setInterval(() => {
      // Like a real teacher: wait a moment in the lobby after the student joins.
      const me = players.find((p) => p.student_id === ME)
      if (s.status === 'lobby' && me && now() - me.seen > 2500 && players.length >= 3) go(nextStep(game.type, s.status, s.index, play.length)!)
      else if (s.status === 'question' && now() > s.endsAt) go(nextStep(game.type, s.status, s.index, play.length)!)
    }, 300)
    setInterval(() => {
      // Each answer and leaderboard stays up for 3 seconds.
      if ((s.status === 'reveal' || s.status === 'leaderboard') && now() - s.enteredAt > 3000) go(nextStep(game.type, s.status, s.index, play.length)!)
    }, 300)
  }

  const standings = () => rankPlayers(players, answers, race)

  const hostState = (): HostState => {
    const q = !race && s.index >= 0 ? game.questions[s.index] : null
    const current = q ? answers.filter((a) => a.question_id === q.id) : []
    return {
      id: 'live-1',
      title: game.title,
      type: game.type,
      pin: '482913',
      className: 'Grade 2 · A',
      status: s.status,
      index: s.index,
      count: play.length,
      liveSeconds: SECONDS,
      serverNow: new Date().toISOString(),
      endsAt: s.status === 'question' ? new Date(s.endsAt).toISOString() : null,
      players: players.map((p) => ({ studentId: p.student_id, nickname: p.nickname, connected: true })),
      question: q,
      answered: current.length,
      distribution: q?.kind === 'choice' && (s.status === 'reveal' || s.status === 'leaderboard') ? q.options.map((_, i) => current.filter((a) => a.choice === i).length) : null,
      standings: standings(),
      gained: Object.fromEntries(current.map((a) => [a.student_id, a.points])),
      race: race ? standings().map((st) => ({ studentId: st.studentId, nickname: st.nickname, done: answers.filter((a) => a.student_id === st.studentId && a.done).length, score: st.score, finished: Boolean(players.find((p) => p.student_id === st.studentId)?.finished_at) })) : null,
    }
  }

  const playerState = (): PlayerState => {
    const revealed = s.status === 'reveal' || s.status === 'leaderboard' || s.status === 'ended'
    const current = !race && s.index >= 0 && s.status !== 'lobby' ? play[s.index] : null
    const full = current ? game.questions[s.index] : null
    const mine = current ? answers.find((a) => a.student_id === ME && a.question_id === current.id) : undefined
    const st = standings()
    const me = st.find((x) => x.studentId === ME)
    return {
      title: game.title,
      type: game.type,
      status: s.status,
      index: s.index,
      count: play.length,
      serverNow: new Date().toISOString(),
      endsAt: s.status === 'question' ? new Date(s.endsAt).toISOString() : null,
      nickname: 'Kavin',
      playersCount: players.length,
      question: s.status === 'question' || revealed ? current : null,
      questions: race && s.status === 'race' ? play : null,
      doneIds: answers.filter((a) => a.student_id === ME && a.done).map((a) => a.question_id),
      myAnswer: current ? (mine ? { choice: mine.choice, correct: revealed ? mine.correct : null, points: revealed ? mine.points : null } : { choice: null, correct: null, points: null }) : null,
      correctIndex: revealed && full?.kind === 'choice' ? full.answerIndex : null,
      score: me?.score ?? 0,
      rank: s.status === 'leaderboard' || s.status === 'ended' || race ? (me?.rank ?? null) : null,
      podium: s.status === 'ended' ? st.slice(0, 3) : null,
    }
  }

  // Returns a reply for live paths, or null for anything else.
  const ME_ACCOUNT = 'user_kavin'
  // The account the browser is signed in as right now.
  const signedInAs = () => (params.get('switch') === '1' && s.status !== 'lobby' ? 'user_someone_else' : ME_ACCOUNT)
  const wrongAccount = (headers: Headers) => {
    const joinedAs = headers.get(PLAYER_HEADER)
    return joinedAs && joinedAs !== signedInAs() ? { data: { error: 'This browser is now signed in as a different student.', code: WRONG_ACCOUNT }, status: 409 } : null
  }

  return (path: string, method: string, body: Record<string, unknown> | null, headers: Headers = new Headers()): { data: unknown; status: number } | null => {
    if (path === '/live/join') {
      if (body?.pin !== '482913') return { data: { error: 'We couldn’t find a live game with that PIN. Check the big screen and try again.' }, status: 404 }
      if (!players.some((p) => p.student_id === ME)) addPlayer(ME, 'Kavin')
      return { data: { sessionId: 'live-1', playerId: ME_ACCOUNT }, status: 200 }
    }
    if (path === '/live/live-1/host') {
      if (method === 'POST') {
        const expect = body?.expect as { status: LiveStatus; index: number }
        if (expect.status === s.status && expect.index === s.index) {
          if (body?.action === 'end') go({ status: 'ended', index: s.index })
          else if (body?.action === 'again') {
            answers.length = 0
            players.forEach((p) => (p.finished_at = null))
            go({ status: 'lobby', index: -1 })
          } else {
            const step = nextStep(game.type, s.status, s.index, play.length)
            if (step) go(step)
          }
        }
      }
      return { data: hostState(), status: 200 }
    }
    if (path === '/live/live-1/me' || path === '/live/live-1/answer') {
      const refused = wrongAccount(headers)
      if (refused) return refused
    }
    if (path === '/live/live-1/me') {
      if (!players.some((p) => p.student_id === ME)) return { data: { error: 'Join the game with its PIN first.' }, status: 403 }
      return { data: playerState(), status: 200 }
    }
    if (path === '/live/live-1/answer') {
      const q = game.questions.find((x) => x.id === body?.questionId)!
      const r = body?.response as Parameters<typeof checkResponse>[1]
      const res = checkResponse(q, r, false)
      if (!race) {
        if (s.status !== 'question' || now() > s.endsAt + 1500) return { data: { error: 'Too late — time is up for this question.' }, status: 409 }
        if (!answers.some((a) => a.student_id === ME && a.question_id === q.id)) answers.push({ student_id: ME, question_id: q.id, choice: (r as { choice: number }).choice, correct: res.correct, points: livePoints(res.correct, now() - s.startedAt, SECONDS * 1000), done: true })
        return { data: { received: true }, status: 200 }
      }
      const done = q.kind !== 'match' || res.correct
      const prev = answers.find((a) => a.student_id === ME && a.question_id === q.id)
      if (!prev) answers.push({ student_id: ME, question_id: q.id, choice: null, correct: res.correct, points: res.correct ? RACE_POINTS_PER_UNIT : 0, done: q.kind !== 'match' })
      else if (res.correct) prev.points += RACE_POINTS_PER_UNIT
      if (q.kind === 'match' && done) {
        const p = answers.find((a) => a.student_id === ME && a.question_id === q.id)!
        const matched = (p as Ans & { matched?: number }).matched ?? 0
        ;(p as Ans & { matched?: number }).matched = matched + 1
        p.done = matched + 1 >= q.pairs.length
      }
      return { data: res, status: 200 }
    }
    return null
  }
}
