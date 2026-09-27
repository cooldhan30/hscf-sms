'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiHeart, FiLayers, FiStar, FiZap, FiTrendingUp, FiPlay, FiClock, FiShield } from 'react-icons/fi'
import { GameV2Loading, GameV2Error } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { NinjaSetupPicker } from './NinjaSetupPicker'
import { NinjaBoard, type DojoClock, type DojoFx } from './NinjaBoard'
import {
  createNinja,
  beginRound,
  stepNinja,
  slash,
  frontWord,
  speedOf,
  canUsePower,
  firePower,
  roundSubmission,
  judgeRound,
  STEP_MS_NINJA,
  WRONG_ROUND_HEARTS,
  type NinjaState,
  type NinjaEvent,
  type PowerId,
  type WordNinjaDifficulty,
} from '@/lib/gameRoomV2/wordNinja'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Word Ninja: an arcade dojo. Each CATEGORIZE question is one round --
// its items fall and the player slashes each into a category lane before
// it lands. Once every word has a lane, the whole mapping is submitted to
// the SAME /answer route every engine uses (graded server-side, all or
// nothing, exactly like CategorizeInput's form); the verdict comes back
// into the arcade as a clean-round bonus or lost hearts. Score, hearts
// and power-ups are in-match only; XP/coins are computed by /complete.
// The session is paused server-side whenever the player pauses
// (useQuestionGate), so the question clock never runs in the pause menu.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Hud {
  phase: NinjaState['phase']
  round: number
  lives: number
  maxLives: number
  combo: number
  score: number
  speed: number
  charges: Record<PowerId, number>
  slowed: boolean
  shield: boolean
  words: { id: number; item: string; golden: boolean }[]
  frontId: number | null
  placedCount: number
  itemsInRound: number
}

function snap(s: NinjaState): Hud {
  return {
    phase: s.phase,
    round: s.round,
    lives: s.lives,
    maxLives: s.maxLives,
    combo: s.combo,
    score: s.score,
    speed: speedOf(s),
    charges: { ...s.charges },
    slowed: s.slowMs > 0,
    shield: s.shield,
    words: s.air.map((w) => ({ id: w.id, item: w.item, golden: w.golden })),
    frontId: frontWord(s)?.id ?? null,
    placedCount: Object.keys(s.placed).length,
    itemsInRound: s.itemsInRound,
  }
}

const POWER_LABEL: Record<PowerId, string> = { slow: 'மெதுநேரம்', shield: 'கேடயம்' }
const POWER_KEY: Record<PowerId, string> = { slow: 'Z', shield: 'X' }

export function WordNinjaGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [difficulty, setDifficulty] = useState<WordNinjaDifficulty | null>(null)
  const ninjaRef = useRef<NinjaState | null>(null)
  const clockRef = useRef<DojoClock>({ lastStepAt: 0, running: false })
  const [hud, setHud] = useState<Hud | null>(null)
  const [userPaused, setUserPaused] = useState(false)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [fx, setFx] = useState<DojoFx[]>([])
  const [shake, setShake] = useState(0)
  const [banner, setBanner] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<{ correct: boolean; text: string; explanation?: string | null } | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [roundIndex, setRoundIndex] = useState(-1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fxId = useRef(0)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled
  const schedule = useManagedTimeouts()
  const { state: session, error: pollError, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!difficulty, soundEnabled })
  const error = pollError || submitError

  const refresh = useCallback(() => {
    if (ninjaRef.current) setHud(snap(ninjaRef.current))
  }, [])

  const addFx = useCallback(
    (f: Omit<DojoFx, 'id'>, ms = 900) => {
      const id = ++fxId.current
      setFx((cur) => [...cur.slice(-10), { ...f, id }])
      schedule(() => setFx((cur) => cur.filter((x) => x.id !== id)), ms)
    },
    [schedule]
  )

  const flash = useCallback(
    (text: string, ms = 1300) => {
      setBanner(text)
      schedule(() => setBanner((cur) => (cur === text ? null : cur)), ms)
    },
    [schedule]
  )

  const handleEvents = useCallback(
    (events: NinjaEvent[], at?: { x: number; y: number }) => {
      const snd = soundRef.current
      let changed = false
      for (const e of events) {
        if (e.type === 'spawn') changed = true
        else if (e.type === 'slash') {
          changed = true
          const p = at ?? { x: 0.5, y: 0.5 }
          addFx({ kind: 'slash', x: p.x, y: p.y, golden: e.golden }, 400)
          addFx({ kind: 'points', x: p.x, y: p.y, text: `+${e.points}`, golden: e.golden })
          playSound('slash', snd)
          if (e.golden) playSound('coin', snd)
          if (e.combo >= 3 && e.combo % 3 === 0) playSound('streak', snd, Math.min(8, e.combo / 3))
        } else if (e.type === 'miss') {
          changed = true
          if (e.shielded) {
            addFx({ kind: 'block', x: 0.5, y: 0.82, text: 'தடுத்தாயிற்று!' })
            playSound('ability', snd)
          } else {
            addFx({ kind: 'miss', x: 0.5, y: 0.82, text: `-1 heart` })
            setShake((n) => n + 1)
            playSound('baseHit', snd)
            vibrate('incorrect', snd)
          }
        } else if (e.type === 'charge') {
          flash(`${POWER_LABEL[e.power]} charged!`, 1000)
          playSound('upgrade', snd)
        } else if (e.type === 'power') {
          playSound('ability', snd)
        } else if (e.type === 'over') {
          playSound('gameOver', snd)
        }
      }
      if (changed) setTargetId((cur) => (cur !== null && ninjaRef.current?.air.some((w) => w.id === cur) ? cur : null))
    },
    [addFx, flash]
  )

  // Create the run once the session is known.
  useEffect(() => {
    if (!difficulty || !session || ninjaRef.current) return
    ninjaRef.current = createNinja({ seed: seedFromString(sessionId), difficulty })
    refresh()
  }, [difficulty, session, sessionId, refresh])

  const sessionDone = session?.status === 'COMPLETED' || !!result
  const runOver = hud?.phase === 'over'
  const wantQuestion = !!hud && !userPaused && !sessionDone
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: !!hud })

  // A new question starts a new round (after a short banner).
  const question = questionReady && session?.question && session.currentIndex > answeredIndex ? session.question : null
  const currentIndex = session?.currentIndex ?? 0
  const totalRounds = session?.totalQuestions ?? 0
  useEffect(() => {
    const s = ninjaRef.current
    if (!s || !question || s.phase !== 'idle' || roundIndex === currentIndex) return
    const items = (question.payload as { items?: unknown }).items
    if (!Array.isArray(items) || items.length === 0) return
    setRoundIndex(currentIndex)
    setVerdict(null)
    flash(`${TA.round.ta} ${currentIndex + 1}`, 1100)
    playSound('waveStart', soundRef.current)
    beginRound(s, items.map(String))
    refresh()
  }, [question, currentIndex, roundIndex, flash, refresh])

  // Dojo loop: fixed 30 Hz steps on requestAnimationFrame; HUD ~8 Hz.
  const flightRunning = !!hud && hud.phase === 'falling' && !userPaused
  useEffect(() => {
    if (!flightRunning) {
      clockRef.current.running = false
      return
    }
    let raf = 0
    let last = performance.now()
    let acc = 0
    let hudAcc = 0
    clockRef.current = { lastStepAt: last, running: true }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const s = ninjaRef.current
      if (!s) return
      const dt = Math.min(250, now - last)
      last = now
      acc += dt
      let stepped = false
      let dirty = false
      while (acc >= STEP_MS_NINJA && s.phase === 'falling') {
        const ev = stepNinja(s)
        if (ev.length) {
          handleEvents(ev)
          dirty = true
        }
        acc -= STEP_MS_NINJA
        stepped = true
      }
      if (stepped) clockRef.current.lastStepAt = now
      hudAcc += dt
      if (dirty || hudAcc > 120 || s.phase !== 'falling') {
        hudAcc = 0
        refresh()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [flightRunning, handleEvents, refresh])

  const doSlash = useCallback(
    (category: string) => {
      const s = ninjaRef.current
      if (!s || s.phase !== 'falling' || userPaused) return
      const w = (targetId !== null && s.air.find((a) => a.id === targetId)) || frontWord(s)
      if (!w) return
      const at = { x: w.x, y: Math.min(0.92, w.y + 0.05) }
      handleEvents(slash(s, category, w.id), at)
      setTargetId(null)
      refresh()
    },
    [targetId, userPaused, handleEvents, refresh]
  )

  const doPower = useCallback(
    (power: PowerId) => {
      const s = ninjaRef.current
      if (!s || userPaused) return
      handleEvents(firePower(s, power))
      refresh()
    },
    [userPaused, handleEvents, refresh]
  )

  // Once every word of the round has a lane, the server grades the round.
  const judging = hud?.phase === 'judging'
  useEffect(() => {
    const s = ninjaRef.current
    if (!judging || !s || submitting || submitError || !session || session.currentIndex !== roundIndex) return
    setSubmitting(true)
    const questionIndex = session.currentIndex
    fetch(`/api/gameroom-v2/sessions/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex, answer: roundSubmission(s) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.isCorrect !== 'boolean') throw new Error(data?.error || 'Failed to submit your round')
        const ev = judgeRound(s, data.isCorrect)
        const j = ev.find((e) => e.type === 'judged') as Extract<NinjaEvent, { type: 'judged' }> | undefined
        setVerdict({
          correct: data.isCorrect,
          text: data.isCorrect
            ? `முழுச் சரி! +${j?.bonus ?? 0} புள்ளிகள்${j?.heart ? ', ஓர் இதயம் திரும்பக் கிடைத்தது' : ''}`
            : `ஒரு சொல் தவறான பாதையில் விழுந்தது -- ${WRONG_ROUND_HEARTS} இதயங்கள் இழப்பு`,
          explanation: typeof data.explanation === 'string' ? data.explanation : null,
        })
        playSound(data.isCorrect ? 'correct' : 'incorrect', soundRef.current)
        vibrate(data.isCorrect ? 'correct' : 'incorrect', soundRef.current)
        handleEvents(ev)
        setAnsweredIndex(questionIndex)
        refresh()
        poll()
      })
      .catch((e: Error) => setSubmitError(e.message || 'Failed to submit your round'))
      .finally(() => setSubmitting(false))
  }, [judging, submitting, submitError, session, roundIndex, sessionId, handleEvents, refresh, poll])

  // Keyboard: 1-5 slash into lanes (arrows for two lanes), Z/X powers, P pause.
  // Lanes come from the question's categories; they stay on screen while
  // the session is paused (when the server withholds the question).
  const rawCategories = (session?.question?.payload as { categories?: unknown } | undefined)?.categories
  const categoriesKey = Array.isArray(rawCategories) ? rawCategories.map(String).join('') : ''
  const [lanes, setLanes] = useState<string[]>([])
  useEffect(() => {
    if (categoriesKey) setLanes(categoriesKey.split(''))
  }, [categoriesKey])

  const keysActive = !!hud && hud.phase !== 'over'
  useEffect(() => {
    if (!keysActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toLowerCase()
      if (k === 'p' || k === 'escape') {
        setUserPaused((p) => !p)
        return
      }
      if (/^[1-9]$/.test(k) && Number(k) <= lanes.length) doSlash(lanes[Number(k) - 1])
      else if (lanes.length === 2 && k === 'arrowleft') doSlash(lanes[0])
      else if (lanes.length === 2 && k === 'arrowright') doSlash(lanes[1])
      else if (k === 'z') doPower('slow')
      else if (k === 'x') doPower('shield')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keysActive, lanes, doSlash, doPower])

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!difficulty) return <NinjaSetupPicker onStart={setDifficulty} />
  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session || !hud || !ninjaRef.current) return <GameV2Loading label="சொல் பயிற்சிக் கூடம் திறக்கிறது... · Opening the dojo..." />
  const s = ninjaRef.current

  if (result) {
    const won = s.phase !== 'over'
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={won ? 'பயிற்சிக் கூடத்தை வென்றீர்கள்!' : 'இதயங்கள் தீர்ந்தன'}
          subline={won ? `${s.lives} இதயங்கள் மீதமிருக்க எல்லாச் சுற்றுகளையும் முடித்தீர்கள்.` : 'சீக்கிரமே வெட்டுங்கள்; சொற்கள் குவிந்தால் மெதுநேரத்தைப் பயன்படுத்துங்கள்.'}
          gameStats={[
            { label: 'வீரர் மதிப்பெண்', value: s.score },
            { label: 'முழுச் சரியான சுற்றுகள்', value: `${s.stats.cleanRounds}/${s.stats.rounds}` },
            { label: 'வெட்டிய சொற்கள்', value: s.stats.slashed },
            { label: 'சிறந்த தொடர் அடி', value: `x${s.stats.bestCombo}` },
            { label: 'பொன் சொற்கள்', value: s.stats.goldens },
            { label: 'தவறவிட்ட சொற்கள்', value: s.stats.missed },
          ]}
          onPlayAgain={onPlayAgain ? again : undefined}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  const effectiveTarget = targetId ?? hud.frontId
  const remaining = Math.max(0, totalRounds - currentIndex)

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiLayers, label: ta('round', true), value: `${Math.min(currentIndex + 1, totalRounds)}/${totalRounds}` },
          { icon: FiStar, label: ta('score', true), value: hud.score, tone: 'gold' },
          { icon: FiZap, label: ta('combo', true), value: `x${hud.combo}`, tone: hud.combo >= 3 ? 'good' : 'default' },
          { icon: FiTrendingUp, label: 'வேகம் · Speed', value: `${hud.speed.toFixed(1)}x` },
          {
            icon: FiHeart,
            label: 'இதயங்கள் · Hearts',
            tone: 'bad',
            value: (
              <span className="inline-flex items-center gap-0.5" aria-label={`${hud.lives} of ${hud.maxLives}`}>
                {Array.from({ length: hud.maxLives }, (_, i) => (
                  <svg key={i} viewBox="0 0 20 18" className={`w-4 h-4 ${i < hud.lives ? 'fill-red-400' : 'fill-white/15'}`} aria-hidden>
                    <path d="M10 17.5 1.8 9.6A5 5 0 0 1 10 3.3a5 5 0 0 1 8.2 6.3Z" />
                  </svg>
                ))}
              </span>
            ),
          },
        ]}
        paused={userPaused}
        onTogglePause={runOver ? undefined : () => setUserPaused((p) => !p)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={leave}
      />
      <div className="max-w-3xl mx-auto px-3 py-3 space-y-3">
        {runOver ? (
          <div className="rounded-2xl bg-slate-900/80 border border-amber-300/30 p-4 space-y-3">
            <p className="text-lg font-bold flex items-center gap-2">
              <FiHeart className="w-5 h-5 text-red-400" aria-hidden /> <span className="font-tamil">இதயங்கள் தீர்ந்தன</span>
            </p>
            <p className="text-sm text-slate-300 font-tamil">
              {TA.score.ta} {hud.score} · சிறந்த தொடர் அடி x{s.stats.bestCombo}. உங்கள் முன்னேற்றத்தைச் சேமிக்க, மீதமுள்ள {remaining} தொகுப்புகளைக் கீழே வகைப்படுத்துங்கள்.
            </p>
            {question ? (
              <QuestionOverlay variant="compact" sessionId={sessionId} question={question} questionIndex={currentIndex} remainingSeconds={session.remainingSeconds} onResult={() => poll()} />
            ) : (
              <GameV2Loading label={sessionDone ? ta('calculating', true) : 'அடுத்த தொகுப்பு... · Next set...'} />
            )}
          </div>
        ) : (
          <>
            {session.question && (
              <div className="rounded-2xl bg-slate-900/80 border border-white/10 px-4 py-2 text-center">
                <p className="font-tamil leading-relaxed text-base sm:text-lg font-bold">{session.question.prompt}</p>
              </div>
            )}
            <div className="relative">
              <NinjaBoard
                stateRef={ninjaRef}
                clockRef={clockRef}
                words={hud.words}
                targetId={effectiveTarget}
                onTarget={setTargetId}
                fx={fx}
                shake={shake}
                slowed={hud.slowed}
                shielded={hud.shield}
              />
              <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
                {banner && <p className="font-tamil rounded-2xl bg-slate-900/90 border border-white/20 px-5 py-2 text-lg font-bold animate-gamev2-pop-in">{banner}</p>}
              </div>
              {(hud.phase === 'judging' || (hud.phase === 'idle' && !sessionDone)) && !userPaused && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div role="status" className="rounded-2xl bg-slate-900/90 border border-white/15 px-5 py-4 text-center max-w-sm">
                    {hud.phase === 'judging' || !verdict ? (
                      <p className="font-bold font-tamil">{hud.phase === 'judging' ? 'உங்கள் பாதைகள் சரிபார்க்கப்படுகின்றன...' : 'அடுத்த சுற்று...'}</p>
                    ) : (
                      <>
                        <p className={`font-bold font-tamil ${verdict.correct ? 'text-emerald-300' : 'text-red-300'}`}>{verdict.text}</p>
                        {verdict.explanation && <p className="mt-1 text-sm text-slate-300 font-tamil leading-relaxed">{verdict.explanation}</p>}
                      </>
                    )}
                  </div>
                </div>
              )}
              {userPaused && (
                <div className="absolute inset-0 rounded-3xl bg-slate-950/80 flex items-center justify-center">
                  <button type="button" onClick={() => setUserPaused(false)} className="inline-flex items-center gap-2 min-h-[52px] px-6 rounded-2xl bg-amber-400 text-slate-900 font-bold text-lg">
                    <FiPlay className="w-5 h-5" aria-hidden /> <Bi k="resume" inline />
                  </button>
                </div>
              )}
            </div>

            {/* Lanes: the slash buttons, in thumb reach under the dojo. */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(0, 1fr))` }} role="group" aria-label="பாதையில் வெட்டு · Slash into a lane">
              {lanes.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    doSlash(c)
                  }}
                  onClick={(e) => {
                    // Keyboard / assistive-tech activation (pointer taps slash on pointerdown).
                    if (e.detail === 0) doSlash(c)
                  }}
                  disabled={hud.phase !== 'falling' || userPaused}
                  className="relative min-h-[64px] rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 font-tamil leading-relaxed font-extrabold text-base sm:text-lg px-2 shadow-[0_4px_0_#92400e] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
                >
                  <span className="absolute top-1 left-2 text-[11px] font-sans font-bold text-amber-900/70" aria-hidden>
                    {i + 1}
                  </span>
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {(['slow', 'shield'] as PowerId[]).map((p) => {
                const Icon = p === 'slow' ? FiClock : FiShield
                const ready = canUsePower(s, p)
                const active = p === 'slow' ? hud.slowed : hud.shield
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => doPower(p)}
                    disabled={!ready || userPaused}
                    aria-label={`${POWER_LABEL[p]} (${hud.charges[p]})`}
                    className={`flex-1 min-h-[48px] rounded-xl border px-3 flex items-center justify-center gap-2 text-sm font-bold ${
                      active ? 'bg-cyan-400/20 border-cyan-300 text-cyan-200' : 'bg-white/5 border-white/10 hover:bg-white/10 disabled:opacity-40'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    <span className="font-tamil">{POWER_LABEL[p]}</span>
                    <span className="tabular-nums text-amber-300">x{hud.charges[p]}</span>
                    <span className="hidden sm:inline text-[11px] text-slate-400">({POWER_KEY[p]})</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 text-center">
              {hud.phase === 'falling' ? `இந்தச் சுற்றில் ${hud.placedCount}/${hud.itemsInRound} சொற்கள் வகைப்படுத்தப்பட்டன · ஒரு சொல்லைத் தொட்டு இலக்காக்கலாம்; இல்லையெனில் கீழுள்ள சொல் வெட்டப்படும்` : ' '}
            </p>
            {submitError && (
              <p className="text-sm text-red-300 text-center">
                {submitError}{' '}
                <button type="button" onClick={() => setSubmitError(null)} className="underline font-bold min-h-[44px] px-2">
                  <Bi k="tryAgain" inline />
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
