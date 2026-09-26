'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiLayers, FiRepeat, FiZap, FiStar, FiPlay } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { usePairCheck } from '@/components/gameRoomV2/cardGrid/usePairCheck'
import { RoundStars } from '@/components/gameRoomV2/cardGrid/RoundStars'
import { MemorySetupPicker } from './MemorySetupPicker'
import { MemoryBoard } from './MemoryBoard'
import {
  createMemoryRound,
  isRoundComplete,
  totalPairs,
  flipCard,
  flippedPairToCheck,
  resolveFlippedPair,
  acknowledgeAttempt,
  buildRoundSubmission,
  memoryStars,
  getMemoryDifficultySettings,
  type MemoryRoundState,
  type MemoryDifficulty,
} from '@/lib/gameRoomV2/memory'
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
  moves: number
  pairs: number
}

// Memory: the question's cards face down; flip two at a time and
// remember where each pair hides. Whether two cards pair up is asked of
// the server (pair-check -- the client never holds the pairs); a cleared
// round's confirmed pairs go to the SAME /answer route every engine uses.
// Stars and streaks are in-match only; points (server-timed), XP and
// coins are computed server-side.
export function MemoryGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<MemoryDifficulty | null>(null)
  const [round, setRound] = useState<MemoryRoundState | null>(null)
  const [roundQuestionId, setRoundQuestionId] = useState<string | null>(null)
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

  const question = session?.status === 'ACTIVE' ? session.question : null
  useEffect(() => {
    if (!difficulty || !question || question.id === roundQuestionId || cleared) return
    setRoundQuestionId(question.id)
    setRound(createMemoryRound(question.payload.left ?? [], question.payload.right ?? [], `${sessionId}:${question.id}`))
  }, [difficulty, question, sessionId, roundQuestionId, cleared])

  // Two cards face up -> verdict (server for a left+right pair), shown
  // for a beat before a mismatch flips back.
  const flippedKey = round && round.flippedCardIds.length === 2 ? round.flippedCardIds.join('|') : null
  useEffect(() => {
    if (!flippedKey || !round || !session || !difficulty) return
    const settings = getMemoryDifficultySettings(difficulty)
    const labels = flippedPairToCheck(round)
    const started = Date.now()
    let cancelled = false
    const verdict = labels ? checkPair(session.currentIndex, labels.left, labels.right) : Promise.resolve(false)
    verdict
      .then((isPair) => {
        if (cancelled) return
        const wait = Math.max(0, (isPair ? 250 : settings.mismatchRevealMs) - (Date.now() - started))
        schedule(() => {
          setRound((prev) => (prev ? resolveFlippedPair(prev, isPair) : prev))
          playSound(isPair ? 'correct' : 'incorrect', soundRef.current)
          if (isPair) vibrate('correct', soundRef.current)
        }, wait)
      })
      .catch(() => {
        if (cancelled) return
        setToast('Could not check that pair -- try again')
        schedule(() => setToast(null), 2000)
        setRound((prev) => (prev ? { ...prev, flippedCardIds: [] } : prev))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flippedKey])

  useEffect(() => {
    if (!round?.lastAttempt) return
    const timeout = window.setTimeout(() => setRound((prev) => (prev ? acknowledgeAttempt(prev) : prev)), 500)
    return () => window.clearTimeout(timeout)
  }, [round?.lastAttempt])

  const roundBest = round?.bestStreak ?? 0
  useEffect(() => {
    setBestStreak((b) => Math.max(b, roundBest))
  }, [roundBest])

  // Every pair found -> submit the confirmed pairs.
  const complete = !!round && isRoundComplete(round)
  useEffect(() => {
    if (!complete || !round || !session?.question || submitting || cleared || submitError) return
    setSubmitting(true)
    fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: session.currentIndex, answer: buildRoundSubmission(round) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.isCorrect !== 'boolean') throw new Error(data?.error || 'Failed to submit your matches')
        const pairs = totalPairs(round)
        const entry: RoundLog = { stars: memoryStars(round.moves, pairs), moves: round.moves, pairs }
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
  }, [complete, round, session, submitting, cleared, submitError, sessionId, poll, schedule])

  const handleFlip = useCallback((cardId: string) => {
    setRound((prev) => (prev ? flipCard(prev, cardId) : prev))
    playSound('button', soundRef.current)
  }, [])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!difficulty) return <MemorySetupPicker onStart={setDifficulty} />
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session) return <GameV2Loading label="Laying out the cards..." />

  if (result) {
    const stars = log.reduce((a, r) => a + r.stars, 0)
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={stars === log.length * 3 && log.length > 0 ? 'Perfect memory!' : 'Every pair found'}
          subline="Fewer flips earn more stars -- try to remember where each card was."
          gameStats={[
            { label: 'Stars', value: `${stars} of ${log.length * 3}` },
            { label: 'Pairs found', value: log.reduce((a, r) => a + r.pairs, 0) },
            { label: 'Flips (pairs of cards)', value: log.reduce((a, r) => a + r.moves, 0) },
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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiLayers, label: 'Round', value: `${Math.min(session.currentIndex + 1, session.totalQuestions)}/${session.totalQuestions}` },
          { icon: FiStar, label: 'Pairs', value: `${found}/${round ? totalPairs(round) : 0}`, tone: 'gold' },
          { icon: FiRepeat, label: 'Flips', value: round?.moves ?? 0 },
          ...(round && round.currentStreak >= 2 ? [{ icon: FiZap, label: 'Streak', value: `x${round.currentStreak}`, tone: 'good' as const }] : []),
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
            <p className="mt-3 text-xl font-bold">Round cleared in {cleared.moves} flips</p>
          </div>
        ) : round ? (
          <MemoryBoard round={round} disabled={submitting} onFlip={handleFlip} />
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
      </div>
    </div>
  )
}
