'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiZap, FiShield, FiHeart, FiTarget, FiRepeat, FiAlertTriangle, FiPlay } from 'react-icons/fi'
import { GameV2Loading, GameV2Error, useGameV2Motion } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState, vibrate } from '@/components/gameRoomV2/gameplay'
import { useManagedTimeouts } from '@/components/gameRoomV2/gameplay/useManagedTimeouts'
import { useQuestionGate } from '@/components/gameRoomV2/gameplay/useQuestionGate'
import { ArenaHud } from '@/components/gameRoomV2/gameplay/ArenaHud'
import { BossPortrait } from './BossPortrait'
import {
  DUEL_BOSSES,
  ACTIONS,
  MAX_ENERGY,
  createDuel,
  resolveAnswer,
  takeAction,
  canAct,
  intentDamage,
  type DuelState,
  type DuelEvent,
  type ActionId,
  type DuelBossId,
  type DuelDifficulty,
  type IntentKind,
} from '@/lib/gameRoomV2/bossBattle/duel'
import { seedFromString } from '@/lib/gameRoomV2/gameplay/rng'
import type { BaseSessionStatePayload } from '@/lib/gameRoomV2/gameplay/sessionPolling'

// Solo Boss Battle -- a turn-based duel (see lib/gameRoomV2/bossBattle/duel.ts).
// Answer -> quick strike + energy -> choose an action against the boss's
// telegraphed move -> the boss acts. Grading is the server's; the session
// is paused server-side while you choose actions and the boss moves.

interface StatePayload extends BaseSessionStatePayload {
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

interface Floater {
  id: number
  text: string
  tone: 'boss' | 'player' | 'heal' | 'crit' | 'info'
}

const ACTION_ICON: Record<ActionId, typeof FiZap> = { strike: FiZap, power: FiTarget, guard: FiShield, heal: FiHeart, ultimate: FiAlertTriangle, rest: FiRepeat }

function intentText(s: DuelState): { title: string; hint: string } {
  const dmg = intentDamage(s)
  const map: Record<IntentKind, { title: string; hint: string }> = {
    strike: { title: `Strike -- ${dmg} damage`, hint: 'A normal attack. Guard if your health is low.' },
    heavy: s.charging
      ? { title: `HEAVY SLAM -- ${dmg} damage!`, hint: 'Interrupt it with Power Blow, or Guard to block most of it.' }
      : { title: `Heavy slam -- ${dmg} damage`, hint: 'Guard to block most of it.' },
    flurry: { title: `Flurry -- 2 x ${dmg} damage`, hint: 'Two quick hits. Guard blocks both.' },
    shield: { title: 'Raising a shield (+30)', hint: 'A free turn to heal or save energy. Tamil Fire burns through shields.' },
    charge: { title: 'Charging a heavy slam...', hint: 'Next turn it slams. Save 4 energy for a Power Blow to interrupt it.' },
  }
  return map[s.intent]
}

export function BossDuelGame({ sessionId, onExit, onPlayAgain, onHome }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [setup, setSetup] = useState<{ bossId: DuelBossId; difficulty: DuelDifficulty } | null>(null)
  const [pickBoss, setPickBoss] = useState<DuelBossId>('irul')
  const duelRef = useRef<DuelState | null>(null)
  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((t) => t + 1), [])
  const [resolving, setResolving] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [answeredIndex, setAnsweredIndex] = useState(-1)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [bossShake, setBossShake] = useState(false)
  const [playerShake, setPlayerShake] = useState(false)
  const [playerFlash, setPlayerFlash] = useState(0)
  const [banner, setBanner] = useState<string | null>(null)
  const [log, setLog] = useState('')
  const floaterId = useRef(0)
  const { soundEnabled, toggleSound } = useSoundPreference()
  const { reduced } = useGameV2Motion()
  const schedule = useManagedTimeouts()
  const { state: session, error, result, poll, exit } = useGameSessionState<StatePayload>({ sessionId, enabled: !!setup, soundEnabled })

  useEffect(() => {
    if (!setup || !session || duelRef.current) return
    duelRef.current = createDuel({ seed: seedFromString(sessionId), bossId: setup.bossId, difficulty: setup.difficulty, totalQuestions: session.totalQuestions })
    rerender()
  }, [setup, session, sessionId, rerender])

  const hitBoss = useCallback(() => {
    setBossShake(true)
    schedule(() => setBossShake(false), 400)
  }, [schedule])
  const hitPlayer = useCallback(() => {
    setPlayerShake(true)
    setPlayerFlash((k) => k + 1)
    schedule(() => setPlayerShake(false), 400)
  }, [schedule])

  const float = useCallback(
    (text: string, tone: Floater['tone']) => {
      const id = ++floaterId.current
      setFloaters((f) => [...f, { id, text, tone }])
      schedule(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100)
    },
    [schedule]
  )

  const handleEvents = useCallback(
    (events: DuelEvent[]) => {
      const lines: string[] = []
      for (const e of events) {
        if (e.type === 'quickStrike') {
          float(e.crit ? `CRIT -${e.damage}` : `-${e.damage}`, e.crit ? 'crit' : 'boss')
          hitBoss()
          playSound(e.crit ? 'streak' : 'hit', soundEnabled, 6)
          lines.push(e.crit ? `Critical strike for ${e.damage}!` : `Your answer strikes for ${e.damage}.`)
        } else if (e.type === 'miss') {
          lines.push('A wrong answer -- the boss sees an opening!')
        } else if (e.type === 'playerAction') {
          if (e.damage > 0) {
            float(`-${e.damage}`, 'boss')
            hitBoss()
            playSound(e.action === 'ultimate' ? 'ability' : 'hit', soundEnabled)
          }
          if (e.shieldAbsorbed > 0) float(`Shield -${e.shieldAbsorbed}`, 'info')
          if (e.heal > 0) {
            float(`+${e.heal}`, 'heal')
            playSound('upgrade', soundEnabled)
          }
          if (e.interrupted) {
            float('INTERRUPTED!', 'crit')
            playSound('achievement', soundEnabled)
          }
          if (e.action === 'guard') playSound('build', soundEnabled)
          lines.push(`${ACTIONS.find((a) => a.id === e.action)!.name}${e.damage ? ` for ${e.damage}` : ''}${e.heal ? `, healed ${e.heal}` : ''}${e.interrupted ? ' -- interrupted the slam!' : ''}.`)
        } else if (e.type === 'bossAttack') {
          if (e.damage > 0) {
            hitPlayer()
            float(`-${e.damage}`, 'player')
            playSound('baseHit', soundEnabled)
            vibrate('incorrect', soundEnabled)
          }
          lines.push(e.damage > 0 ? `The boss hits you for ${e.damage}${e.blocked ? ` (${e.blocked} blocked)` : ''}.` : 'The boss attack is stopped.')
        } else if (e.type === 'bossShield') {
          lines.push(`The boss raises a shield (+${e.amount}).`)
          playSound('build', soundEnabled)
        } else if (e.type === 'bossCharge') {
          lines.push('The boss is charging a heavy slam!')
          playSound('bossWarning', soundEnabled)
        } else if (e.type === 'phase') {
          setBanner(e.index === 2 ? `${e.name} -- the boss is enraged!` : e.name)
          schedule(() => setBanner(null), 2200)
          playSound('bossWarning', soundEnabled)
        } else if (e.type === 'revive') {
          setBanner(`${duelRef.current?.boss.name ?? 'The boss'} rises again -- final form!`)
          schedule(() => setBanner(null), 2600)
          playSound('bossWarning', soundEnabled)
          lines.push('The boss is not finished -- it rises again in its final form!')
        } else if (e.type === 'victory') {
          playSound('victory', soundEnabled)
          vibrate('victory', soundEnabled)
        } else if (e.type === 'defeat' || e.type === 'escaped') {
          playSound('gameOver', soundEnabled)
        }
      }
      if (lines.length) setLog(lines.join(' '))
    },
    [float, schedule, soundEnabled, hitBoss, hitPlayer]
  )

  const duel = duelRef.current
  const answered = session?.currentIndex ?? 0
  const sessionDone = session?.status === 'COMPLETED' || !!result
  const remaining = session ? Math.max(0, session.totalQuestions - answered) : 0
  const over = duel?.step === 'over'
  const wantQuestion = !!duel && !userPaused && !resolving && !sessionDone && (duel.step === 'question' || (over && remaining > 0))
  const { questionReady } = useQuestionGate({ sessionId, state: session, wantQuestion, poll, enabled: !!duel })
  const showQuestion = questionReady && !!session?.question && session.currentIndex > answeredIndex

  function handleAnswer(res: { correct: boolean; points: number }) {
    const d = duelRef.current
    if (!d || !session) return
    setAnsweredIndex(session.currentIndex)
    if (d.step === 'question') {
      const ev: DuelEvent[] = []
      resolveAnswer(d, res, ev)
      handleEvents(ev)
    }
    rerender()
    poll()
  }

  function act(action: ActionId) {
    const d = duelRef.current
    if (!d || !canAct(d, action)) return
    const ev: DuelEvent[] = []
    takeAction(d, action, ev)
    handleEvents(ev)
    setResolving(true)
    schedule(() => setResolving(false), reduced ? 300 : 1100)
    rerender()
  }

  const leave = () => exit(onExit)
  const again = () => exit(onPlayAgain ?? onExit)

  if (!setup) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-3xl bg-gradient-to-b from-indigo-950 to-slate-950 border border-white/10 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">Boss Battle</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Face the Boss</h1>
          <p className="text-sm text-slate-300 mt-2">
            Each turn: answer to strike and earn energy, then choose your move. Watch what the boss is about to do -- guard its slams, interrupt its charges, and save up for Tamil Fire.
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Choose a boss">
            {DUEL_BOSSES.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={pickBoss === b.id}
                onClick={() => setPickBoss(b.id)}
                className={`rounded-2xl border p-3 text-left transition-colors ${pickBoss === b.id ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              >
                <BossPortrait id={b.id} phase={0} charging={false} shielded={false} className="w-20 h-20 mx-auto" />
                <p className="font-semibold mt-1">{b.name}</p>
                <p className="font-tamil leading-relaxed text-sm text-slate-300">{b.tamilName}</p>
                <p className="text-xs text-slate-400">{b.title}</p>
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold mt-5 mb-2">Difficulty</p>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'normal', 'hard'] as DuelDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSetup({ bossId: pickBoss, difficulty: d })}
                className="min-h-[52px] rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold capitalize"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !session) return <GameV2Error description={error} onRetry={poll} />
  if (!session || !duel) return <GameV2Loading label="The boss approaches..." />

  if (over && result) {
    const headline = duel.outcome === 'victory' ? `${duel.boss.name} defeated!` : duel.outcome === 'defeat' ? 'You were defeated' : `${duel.boss.name} escaped`
    return (
      <div className="min-h-screen w-full bg-slate-950 px-4 py-8">
        <GameResultsScreen
          result={result}
          headline={headline}
          subline={duel.outcome === 'victory' ? (duel.finalFormDefeated ? `You beat both forms in ${duel.turn} turns!` : duel.revived ? 'You beat its first form and survived its final form.' : `In ${duel.turn} turns.`) : `The boss had ${Math.round((duel.bossHp / duel.bossMaxHp) * 100)}% health left.`}
          gameStats={[
            { label: 'Damage dealt', value: duel.stats.damageDealt },
            { label: 'Phase reached', value: `${duel.phase + 1}/3` },
            { label: 'Critical hits', value: duel.stats.crits },
            { label: 'Interrupts', value: duel.stats.interrupts },
            { label: 'Damage blocked', value: duel.stats.blocked },
            { label: 'Your health', value: `${duel.playerHp}/${duel.playerMaxHp}` },
          ]}
          onPlayAgain={onPlayAgain ? again : undefined}
          onExit={onExit}
          onHome={onHome}
        />
      </div>
    )
  }

  const intent = intentText(duel)
  const bossPct = (duel.bossHp / duel.bossMaxHp) * 100
  const shieldPct = Math.min(100, (duel.bossShield / duel.bossMaxHp) * 100)

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 text-white">
      <ArenaHud
        stats={[
          { icon: FiRepeat, label: 'Turn', value: `${duel.turn}/${duel.totalTurns}` },
          { icon: FiZap, label: 'Energy', value: `${duel.energy}/${MAX_ENERGY}`, tone: 'gold' },
          ...(duel.streak >= 2 ? [{ icon: FiTarget, label: 'Streak', value: `x${duel.streak}`, tone: 'good' as const }] : []),
        ]}
        health={{ value: duel.playerHp, max: duel.playerMaxHp, label: 'You' }}
        paused={userPaused}
        onTogglePause={() => setUserPaused((p) => !p)}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={leave}
      />
      <div className="max-w-5xl mx-auto px-3 py-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className={`relative rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6 overflow-hidden ${playerShake && !reduced ? 'animate-gamev2-shake' : ''}`}>
          {playerFlash > 0 && !reduced && (
            <motion.div key={`f${playerFlash}`} className="absolute inset-0 bg-red-600 pointer-events-none" initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{duel.boss.name}</p>
              <p className="font-tamil leading-relaxed text-sm text-slate-300">
                {duel.boss.tamilName} · {duel.revived ? 'Final Form' : duel.boss.phaseNames[duel.phase]}
              </p>
            </div>
            <p className="text-sm tabular-nums text-slate-300">
              {duel.bossHp}/{duel.bossMaxHp}
              {duel.bossShield > 0 && <span className="text-sky-300"> +{duel.bossShield} shield</span>}
            </p>
          </div>
          <div className="relative h-4 mt-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-label="Boss health" aria-valuenow={Math.round(bossPct)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className={`h-full ${duel.phase === 2 ? 'bg-rose-500' : 'bg-red-500'}`} initial={false} animate={{ width: `${bossPct}%` }} transition={{ duration: 0.4 }} />
            {shieldPct > 0 && <div className="absolute inset-y-0 left-0 bg-sky-400/60" style={{ width: `${shieldPct}%` }} />}
            <div className="absolute inset-y-0 border-l-2 border-white/50" style={{ left: '33.3%' }} />
            <div className="absolute inset-y-0 border-l-2 border-white/50" style={{ left: '66.6%' }} />
          </div>

          <div className="relative flex justify-center mt-4">
            <div className={bossShake && !reduced ? 'animate-gamev2-shake brightness-150' : ''}>
              <BossPortrait id={duel.boss.id} phase={duel.phase} charging={duel.intent === 'heavy' && duel.charging} shielded={duel.bossShield > 0} className="w-44 h-44 sm:w-56 sm:h-56" />
            </div>
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-end justify-start pt-2 pr-2 sm:pr-8">
              <AnimatePresence>
                {floaters.map((f) => (
                  <motion.p
                    key={f.id}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -30, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className={`text-2xl font-black [text-shadow:0_2px_0_rgba(0,0,0,0.7)] ${
                      f.tone === 'crit' ? 'text-yellow-300 text-3xl' : f.tone === 'heal' ? 'text-emerald-300' : f.tone === 'player' ? 'text-rose-400' : f.tone === 'info' ? 'text-sky-300 text-lg' : 'text-white'
                    }`}
                  >
                    {f.text}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl border px-4 py-3 ${duel.intent === 'heavy' && duel.charging ? 'border-rose-400 bg-rose-500/15' : duel.intent === 'charge' ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/10 bg-white/5'}`}>
            <p className="text-xs uppercase tracking-wide text-slate-400">Boss intent</p>
            <p className="font-bold">{intent.title}</p>
            <p className="text-sm text-slate-300">{intent.hint}</p>
          </div>
          <p aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm text-slate-200">
            {log}
          </p>
          {banner && (
            <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none">
              <p className="rounded-2xl bg-rose-900/90 border border-rose-400 px-5 py-2 text-xl font-bold animate-gamev2-pop-in">{banner}</p>
            </div>
          )}
          {userPaused && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
              <button type="button" onClick={() => setUserPaused(false)} className="inline-flex items-center gap-2 min-h-[52px] px-6 rounded-2xl bg-yellow-400 text-slate-900 font-bold text-lg">
                <FiPlay className="w-5 h-5" aria-hidden /> Resume
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Energy</span>
              <span className="tabular-nums text-yellow-300">{duel.energy}</span>
            </div>
            <div className="flex gap-1 mt-2" aria-hidden>
              {Array.from({ length: MAX_ENERGY }).map((_, i) => (
                <div key={i} className={`h-3 flex-1 rounded-sm ${i < duel.energy ? 'bg-yellow-400' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>

          {over ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <p className="text-xl font-bold">{duel.outcome === 'victory' ? 'Victory!' : duel.outcome === 'defeat' ? 'Defeated' : 'The boss escaped'}</p>
              {remaining > 0 ? (
                <>
                  <p className="text-sm text-slate-300 mt-1">Answer the last {remaining} question{remaining === 1 ? '' : 's'} to save your XP and progress.</p>
                  <div className="mt-2">
                    {showQuestion && session.question ? (
                      <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
                    ) : (
                      <GameV2Loading label="Loading..." />
                    )}
                  </div>
                </>
              ) : (
                <GameV2Loading label="Calculating your results..." />
              )}
            </div>
          ) : duel.step === 'question' ? (
            <div className="rounded-2xl bg-white/5 border border-yellow-300/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Answer to attack</p>
              <p className="text-xs text-slate-300 mt-0.5">Correct: a quick strike + 2 energy (fast: +1). Three fast in a row: critical hit!</p>
              <div className="mt-2">
                {showQuestion && session.question ? (
                  <QuestionOverlay variant="compact" sessionId={sessionId} question={session.question} questionIndex={session.currentIndex} remainingSeconds={session.remainingSeconds} onResult={handleAnswer} />
                ) : (
                  <GameV2Loading label={resolving ? 'The boss moves...' : 'Readying...'} />
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <p className="text-sm font-semibold mb-2">Choose your move</p>
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map((a) => {
                  const Icon = ACTION_ICON[a.id]
                  const enabled = canAct(duel, a.id) && !resolving
                  const suggested = (a.id === 'power' && duel.intent === 'heavy' && duel.charging) || (a.id === 'ultimate' && duel.bossShield > 0)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!enabled}
                      onClick={() => act(a.id)}
                      title={a.description}
                      className={`text-left rounded-xl p-2.5 min-h-[56px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        suggested && enabled ? 'border-yellow-300 bg-yellow-300/15' : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Icon className="w-4 h-4" aria-hidden /> {a.name}
                      </span>
                      <span className="block text-[11px] text-slate-300 leading-snug">{a.cost ? `${a.cost} energy · ` : ''}{a.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
