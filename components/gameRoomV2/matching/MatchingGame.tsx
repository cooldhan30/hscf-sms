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
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { CelebrationLayer, type CelebrationHandle } from '@/components/gameRoomV2/celebration/CelebrationLayer'

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
  const reduced = !!useGameV2Motion().reduced
  const celebrateRef = useRef<CelebrationHandle>(null)
  const pairStreak = useRef(0)
  const celebratedResult = useRef(false)
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
        pairStreak.current = isPair ? pairStreak.current + 1 : 0
        if (isPair) celebrateRef.current?.correct({ streak: pairStreak.current, card: false, sound: false })
        vibrate(isPair ? 'correct' : 'incorrect', soundRef.current)
      })
      .catch(() => {
        if (cancelled) return
        setRound((prev) => (prev ? cancelAttempt(prev) : prev))
        setToast('இணையைச் சரிபார்க்க முடியவில்லை -- மீண்டும் முயலுங்கள்')
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
        // A perfect round is a milestone: the stronger burst.
        if (entry.stars === 3) celebrateRef.current?.correct({ streak: pairStreak.current, milestone: true, card: false, sound: false })
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

  // A finished set gets the full celebration once the rewards are in.
  useEffect(() => {
    if (!result || celebratedResult.current) return
    celebratedResult.current = true
    const id = window.setTimeout(() => celebrateRef.current?.victory({ rewards: [{ kind: 'xp', amount: result.xpEarned }, { kind: 'coins', amount: result.coinsEarned }] }), 250)
    return () => window.clearTimeout(id)
  }, [result])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!difficulty) return <MatchingSetupPicker onStart={setDifficulty} />
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session) return <GameV2Loading label="அட்டைகள் கலக்கப்படுகின்றன... · Shuffling the cards..." />

  if (result) {
    const stars = log.reduce((a, r) => a + r.stars, 0)
    const perfect = log.filter((r) => r.perfect).length
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <CelebrationLayer ref={celebrateRef} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
        <GameResultsScreen
          result={result}
          headline={perfect === log.length && log.length > 0 ? 'அனைத்தும் சரியான இணைகள்!' : 'எல்லா இணைகளும் கண்டுபிடிக்கப்பட்டன'}
          subline={perfect === log.length ? 'ஒவ்வொரு இணையும் முதல் முயற்சியிலேயே சரி.' : 'குழப்பம் இருந்த சுற்றுகள் பயிற்சியாகக் கணக்கிடப்படும் -- மீண்டும் விளையாடி முதல் முயற்சியிலேயே வெல்லுங்கள்.'}
          gameStats={[
            { label: 'நட்சத்திரங்கள்', value: `${stars}/${log.length * 3}` },
            { label: 'முதல் முயற்சிச் சுற்றுகள்', value: `${perfect}/${log.length}` },
            { label: 'கண்டுபிடித்த இணைகள்', value: log.reduce((a, r) => a + r.pairs, 0) },
            { label: 'குழப்பங்கள்', value: log.reduce((a, r) => a + r.mistakes, 0) },
            { label: TA.bestStreak.ta, value: `x${bestStreak}` },
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
      <CelebrationLayer ref={celebrateRef} soundEnabled={soundEnabled} reducedMotion={reduced} fixed />
      <ArenaHud
        stats={[
          { icon: FiLayers, label: ta('round', true), value: `${Math.min(session.currentIndex + 1, session.totalQuestions)}/${session.totalQuestions}` },
          { icon: FiStar, label: ta('pairs', true), value: `${found}/${pairsTotal}`, tone: 'gold' },
          { icon: FiRepeat, label: 'குழப்பங்கள் · Mix-ups', value: round?.mistakes ?? 0, tone: round && round.mistakes > 0 ? 'bad' : 'default' },
          ...(round && round.currentStreak >= 2 ? [{ icon: FiZap, label: ta('streak', true), value: `x${round.currentStreak}`, tone: 'good' as const }] : []),
          ...(roundSecondsRemaining !== null ? [{ icon: FiClock, label: ta('time', true), value: timedOut ? TA.timeUp.ta : `${roundSecondsRemaining}s`, tone: roundSecondsRemaining <= 5 ? ('bad' as const) : ('default' as const) }] : []),
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
          <p role="status" className="font-tamil text-center text-sm font-bold text-amber-300">
            {toast}
          </p>
        )}
        {paused ? (
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-8 text-center">
            <p className="font-bold text-lg"><Bi k="paused" /></p>
            <button type="button" onClick={() => togglePause()} className="mt-4 inline-flex items-center gap-2 min-h-[48px] px-6 rounded-2xl bg-amber-400 text-slate-900 font-bold">
              <FiPlay className="w-5 h-5" aria-hidden /> <Bi k="resume" inline />
            </button>
          </div>
        ) : cleared ? (
          <div role="status" className="rounded-2xl bg-slate-900 border border-white/10 p-8 text-center animate-gamev2-pop-in">
            <RoundStars stars={cleared.stars} />
            <p className="font-tamil mt-3 text-xl font-bold">{cleared.perfect ? 'ஒவ்வொரு இணையும் முதல் முயற்சியிலேயே சரி!' : 'சுற்று முடிந்தது'}</p>
            {!cleared.perfect && <p className="font-tamil text-sm text-slate-300 mt-1">வழியில் {cleared.mistakes} குழப்பங்கள்.</p>}
          </div>
        ) : round ? (
          <MatchingBoard round={round} disabled={submitting} onSelect={handleSelect} />
        ) : (
          <GameV2Loading label={session.status === 'COMPLETED' ? ta('calculating', true) : 'அடுத்த சுற்று... · Dealing the next round...'} />
        )}
        {submitError && (
          <p className="text-sm text-red-300 text-center">
            {submitError}{' '}
            <button type="button" onClick={() => setSubmitError(null)} className="underline font-bold min-h-[44px] px-2">
              <Bi k="tryAgain" inline />
            </button>
          </p>
        )}
        {round && !cleared && !paused && <p className="text-xs text-slate-400 text-center"><span className="font-tamil">இடப்பக்க அட்டையைத் தொட்டு, பிறகு வலப்பக்கத்தில் அதன் இணையைத் தொடுங்கள்.</span></p>}
      </div>
    </div>
  )
}
