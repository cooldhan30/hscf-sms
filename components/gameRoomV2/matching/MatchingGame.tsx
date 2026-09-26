'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiLayers, FiRepeat, FiZap, FiClock, FiStar, FiPlay } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { usePairCheck } from '@/components/gameRoomV2/cardGrid/usePairCheck'
import { MatchingSetupPicker } from './MatchingSetupPicker'
import { MatchingBoard } from './MatchingBoard'
import { RoundStars } from '@/components/gameRoomV2/cardGrid/RoundStars'
import {
  createMatchingRound,
  isRoundComplete,
  totalPairs,
  selectCard,
  pendingLabels,
  resolveAttempt,
  cancelAttempt,
  acknowledgeAttempt,
  buildRoundSubmission,
  matchingStars,
  getMatchingDifficultySettings,
  roundTimeLimitForIndex,
  type MatchingRoundState,
  type MatchingDifficulty,
} from '@/lib/gameRoomV2/matching'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

interface MatchQuestion {
  id: string
  prompt: string
  payload: { left?: string[]; right?: string[] }
}

interface StatePayload extends BaseSessionStatePayload {
  question: MatchQuestion | null
}

interface RoundLog {
  stars: 1 | 2 | 3
  mistakes: number
  perfect: boolean
  pairs: number
}

const ATTEMPT_FEEDBACK_MS = 650

// Matching: every card face-up in two columns; tap one from each side to
// claim a pair. Each claim is checked by the server (pair-check -- the
// client never holds the pairs), a round is complete once every pair is
// found, and the round's FIRST-try mapping is submitted to the SAME
// /answer route every engine uses, so a round solved by trial and error
// is graded as not known. Stars, streaks and the round timer are
// in-match only; score/XP/coins are computed server-side.
export function MatchingGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<MatchingDifficulty | null>(null)
  const [round, setRound] = useState<MatchingRoundState | null>(null)
  const [roundQuestionId, setRoundQuestionId] = useState<string | null>(null)
  const [roundSecondsRemaining, setRoundSecondsRemaining] = useState<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cleared, setCleared] = useState<RoundLog | null>(null)
  const [log, setLog] = useState<RoundLog[]>([])
  const [bestStreak, setBestStreak] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const checkPair = usePairCheck(sessionId)
  const { state: session, error: pollError, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })
  const error = pollError || submitError

  // A new MATCH question deals a new round (pairs come only from the
  // session's Question Set).
  const question = session?.status === 'ACTIVE' ? session.question : null
  useEffect(() => {
    if (!difficulty || !question || !session || question.id === roundQuestionId || cleared) return
    setRoundQuestionId(question.id)
    setRound(createMatchingRound(question.payload.left ?? [], question.payload.right ?? [], `${sessionId}:${question.id}`))
    setRoundSecondsRemaining(roundTimeLimitForIndex(getMatchingDifficultySettings(difficulty), session.currentIndex))
    setTimedOut(false)
  }, [difficulty, question, session, sessionId, roundQuestionId, cleared])

  // Round timer (Quick / Speedster): running out doesn't end the round,
  // it costs the time star.
  const countdownRunning = roundSecondsRemaining !== null && roundSecondsRemaining > 0 && session?.status === 'ACTIVE' && !submitting && !cleared && !!round
  useEffect(() => {
    if (!countdownRunning) return
    const interval = window.setInterval(() => {
      setRoundSecondsRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [countdownRunning])
  useEffect(() => {
    if (roundSecondsRemaining === null) return
    if (roundSecondsRemaining === 0) setTimedOut(true)
    else if (roundSecondsRemaining <= 5) playSound('countdown', soundRef.current)
  }, [roundSecondsRemaining])

  // Clear the matched/mismatched flash after a beat.
  useEffect(() => {
    if (!round?.lastAttempt) return
    const timeout = window.setTimeout(() => setRound((prev) => (prev ? acknowledgeAttempt(prev) : prev)), ATTEMPT_FEEDBACK_MS)
    return () => window.clearTimeout(timeout)
  }, [round?.lastAttempt])

  // A claimed pair -> ask the server.
  const pendingKey = round?.pending ? `${round.pending.leftId}|${round.pending.rightId}` : null
  useEffect(() => {
    if (!pendingKey || !round || !session) return
    const labels = pendingLabels(round)
    if (!labels) return
    let cancelled = false
    checkPair(session.currentIndex, labels.left, labels.right)
      .then((isPair) => {
        if (cancelled) return
        setRound((prev) => (prev ? resolveAttempt(prev, isPair) : prev))
        playSound(isPair ? 'correct' : 'incorrect', soundRef.current)
        vibrate(isPair ? 'correct' : 'incorrect', soundRef.current)
      })
      .catch(() => {
        if (cancelled) return
        setRound((prev) => (prev ? cancelAttempt(prev) : prev))
        setToast('Could not check that pair -- try again')
        schedule(() => setToast(null), 2000)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey])

  const roundBest = round?.bestStreak ?? 0
  useEffect(() => {
    setBestStreak((b) => Math.max(b, roundBest))
  }, [roundBest])

  // Every pair found -> the server grades the round's first-try mapping.
  const complete = !!round && isRoundComplete(round)
  useEffect(() => {
    if (!complete || !round || !session?.question || submitting || cleared || submitError) return
    setSubmitting(true)
    const questionIndex = session.currentIndex
    fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answer: buildRoundSubmission(round) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.isCorrect !== 'boolean') throw new Error(data?.error || 'Failed to submit your matches')
        const entry: RoundLog = { stars: matchingStars(round.mistakes, timedOut), mistakes: round.mistakes, perfect: data.isCorrect, pairs: totalPairs(round) }
        setLog((l) => [...l, entry])
        setCleared(entry)
        playSound(entry.stars === 3 ? 'streak' : 'checkpoint', soundRef.current, 4)
        schedule(() => {
          setCleared(null)
          setRound(null)
          poll()
        }, 1600)
      })
      .catch((e: Error) => setSubmitError(e.message || 'Failed to submit your matches'))
      .finally(() => setSubmitting(false))
  }, [complete, round, session, submitting, cleared, submitError, sessionId, timedOut, poll, schedule])

  const handleSelect = useCallback((cardId: string) => {
    setRound((prev) => (prev ? selectCard(prev, cardId) : prev))
    playSound('button', soundRef.current)
  }, [])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!difficulty) return <MatchingSetupPicker onStart={setDifficulty} />
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session) return <GameV2Loading label="Shuffling the cards..." />

  if (result) {
    const stars = log.reduce((a, r) => a + r.stars, 0)
    const perfect = log.filter((r) => r.perfect).length
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={perfect === log.length && log.length > 0 ? 'Perfect pairing!' : 'All pairs found'}
          subline={perfect === log.length ? 'Every pair right first time.' : 'Rounds with a mix-up count as practice -- play again to get them first time.'}
          gameStats={[
            { label: 'Stars', value: `${stars} of ${log.length * 3}` },
            { label: 'First-try rounds', value: `${perfect} of ${log.length}` },
            { label: 'Pairs found', value: log.reduce((a, r) => a + r.pairs, 0) },
            { label: 'Mix-ups', value: log.reduce((a, r) => a + r.mistakes, 0) },
            { label: 'Best streak', value: `x${bestStreak}` },
          ]}
          onPlayAgain={onPlayAgain ? again : undefined}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  const paused = session.status === 'PAUSED'
  const found = round ? Object.keys(round.pairs).length : 0
  const pairsTotal = round ? totalPairs(round) : 0

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiLayers, label: 'Round', value: `${Math.min(session.currentIndex + 1, session.totalQuestions)}/${session.totalQuestions}` },
          { icon: FiStar, label: 'Pairs', value: `${found}/${pairsTotal}`, tone: 'gold' },
          { icon: FiRepeat, label: 'Mix-ups', value: round?.mistakes ?? 0, tone: round && round.mistakes > 0 ? 'bad' : 'default' },
          ...(round && round.currentStreak >= 2 ? [{ icon: FiZap, label: 'Streak', value: `x${round.currentStreak}`, tone: 'good' as const }] : []),
          ...(roundSecondsRemaining !== null ? [{ icon: FiClock, label: 'Time', value: timedOut ? "Time's up" : `${roundSecondsRemaining}s`, tone: roundSecondsRemaining <= 5 ? ('bad' as const) : ('default' as const) }] : []),
        ]}
        paused={paused}
        onTogglePause={() => togglePause()}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={leave}
      />
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-3">
        {session.question && !paused && (
          <p className="text-center font-tamil leading-relaxed text-base sm:text-lg font-bold text-slate-100">{session.question.prompt}</p>
        )}
        {toast && (
          <p role="status" className="text-center text-sm font-bold text-amber-300">
            {toast}
          </p>
        )}
        {paused ? (
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-8 text-center">
            <p className="font-bold text-lg">Paused</p>
            <button type="button" onClick={() => togglePause()} className="mt-4 inline-flex items-center gap-2 min-h-[48px] px-6 rounded-2xl bg-amber-400 text-slate-900 font-bold">
              <FiPlay className="w-5 h-5" aria-hidden /> Resume
            </button>
          </div>
        ) : cleared ? (
          <div role="status" className="rounded-2xl bg-slate-900 border border-white/10 p-8 text-center animate-gamev2-pop-in">
            <RoundStars stars={cleared.stars} />
            <p className="mt-3 text-xl font-bold">{cleared.perfect ? 'Every pair right first time!' : 'Round cleared'}</p>
            {!cleared.perfect && <p className="text-sm text-slate-300 mt-1">{cleared.mistakes} mix-up{cleared.mistakes === 1 ? '' : 's'} on the way.</p>}
          </div>
        ) : round ? (
          <MatchingBoard round={round} disabled={submitting} onSelect={handleSelect} />
        ) : (
          <GameV2Loading label={session.status === 'COMPLETED' ? 'Calculating your results...' : 'Dealing the next round...'} />
        )}
        {submitError && (
          <p className="text-sm text-red-300 text-center">
            {submitError}{' '}
            <button type="button" onClick={() => setSubmitError(null)} className="underline font-bold min-h-[44px] px-2">
              Try again
            </button>
          </p>
        )}
        {round && !cleared && !paused && <p className="text-xs text-slate-400 text-center">Tap a card on the left, then its partner on the right.</p>}
      </div>
    </div>
  )
}
