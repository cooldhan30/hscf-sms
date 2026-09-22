'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GameV2Card, GameV2Button, GameV2Loading, GameV2Error, useGameV2Motion } from '@/components/gameRoomV2'
import { QuestionOverlay, type QuestionOverlayQuestion, GameResultsScreen, useSoundPreference, playSound, useGameSessionState } from '@/components/gameRoomV2/gameplay'
import { DifficultyPicker } from './DifficultyPicker'
import { Battlefield } from './Battlefield'
import { TowerShop } from './TowerShop'
import {
  createInitialBattlefield,
  startWave,
  placeTower,
  upgradeTower,
  applyWrongAnswerConsequence,
  applyCorrectAnswerReward,
  tickBattlefield,
  advanceToNextWave,
  type BattlefieldState,
  type ImpactEvent,
  type TowerTypeId,
  type TowerDefenseDifficulty,
} from '@/lib/gameRoomV2/towerDefense'

const TOTAL_WAVES = 6
// A correct answer's reward, converted into in-game coins (separate
// from the account's real XP/coins ledger -- see this component's own
// header note in the design pass): kept generous enough that answering
// questions is clearly the dominant way to afford towers, so a student
// who skips questions cannot out-build the waves.
const CORRECT_ANSWER_COINS = 25
const SIM_INTERVAL_MS = 100

interface StatePayload {
  status: 'CREATED' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  question: QuestionOverlayQuestion | null
}

// Tower Defense's own top-level play screen -- composes directly around
// QuestionOverlay and the shared session API routes
// (state/answer/pause/resume/abandon/complete) rather than mounting
// GameSessionRuntime, per that component's own documented extension
// point for engines that want a battlefield instead of a plain question
// card. The battlefield simulation itself (tower placement, enemy
// movement, wave state) is deliberately client-local, ephemeral
// gameplay state -- only the question-answering progress and the real
// XP/coins ledger are persisted server-side, exactly as the shared
// framework already guarantees for every engine.
export function TowerDefenseGame({ sessionId, onExit, onPlayAgain }: { sessionId: string; onExit: () => void; onPlayAgain?: () => void }) {
  const [difficulty, setDifficulty] = useState<TowerDefenseDifficulty | null>(null)
  const [battlefield, setBattlefield] = useState<BattlefieldState | null>(null)
  const [impacts, setImpacts] = useState<ImpactEvent[]>([])
  const [selectedTowerType, setSelectedTowerType] = useState<TowerTypeId>('vel')
  const [selectedPadId, setSelectedPadId] = useState<string | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [waveMessage, setWaveMessage] = useState<string | null>(null)
  const { soundEnabled } = useSoundPreference()
  const { reduced } = useGameV2Motion()
  const { state: sessionState, error, result, poll, togglePause, exit } = useGameSessionState<StatePayload>({
    sessionId,
    enabled: !!difficulty,
    soundEnabled,
  })

  // Local battlefield simulation clock -- independent of the 2s session
  // poll, since enemy movement needs to feel real-time. Frozen whenever
  // a question is being shown or the session itself is paused, so
  // "learning matters more than twitch speed": the board never punishes
  // a student for time spent thinking. Kept RUNNING even after the
  // session's questions are exhausted (status COMPLETED) so a shorter
  // Question Set than the wave count doesn't strand an in-progress
  // battle -- the player finishes the fight with whatever towers they
  // already built, then sees their results once gameOver/victory lands.
  useEffect(() => {
    if (!battlefield || showQuestion || sessionState?.status === 'PAUSED' || battlefield.gameOver || battlefield.victory) return

    const interval = setInterval(() => {
      setBattlefield((prev) => {
        if (!prev) return prev
        const result = tickBattlefield(prev, SIM_INTERVAL_MS)
        if (result.impacts.length > 0) {
          setImpacts(result.impacts)
          window.setTimeout(() => setImpacts((cur) => cur.filter((i) => !result.impacts.includes(i))), 350)
        }
        if (result.waveCleared && !result.state.victory) {
          setWaveMessage(`Wave ${prev.wave} cleared!`)
        }
        if (result.state.gameOver) playSound('incorrect', soundEnabled)
        if (result.state.victory) playSound('complete', soundEnabled)
        return result.state
      })
    }, SIM_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [battlefield, showQuestion, sessionState?.status, soundEnabled])

  // A fresh question opportunity opens periodically while a wave is
  // active -- the exact core loop the spec describes ("wave begins ->
  // enemies advance -> question opportunity"). Questions are pulled
  // exclusively from sessionState.question, sourced by the server from
  // the session's linked Question Set; nothing here ever invents or
  // embeds question content.
  useEffect(() => {
    if (!battlefield || !sessionState || sessionState.status !== 'ACTIVE' || !sessionState.question) return
    if (battlefield.gameOver || battlefield.victory) return
    if (showQuestion) return
    setShowQuestion(true)
  }, [battlefield, sessionState, showQuestion])

  function handleStart(chosen: TowerDefenseDifficulty) {
    setDifficulty(chosen)
    setBattlefield(startWave(createInitialBattlefield(chosen, TOTAL_WAVES)))
  }

  function handleAnswerResult(res: { correct: boolean }) {
    setShowQuestion(false)
    setBattlefield((prev) => {
      if (!prev) return prev
      return res.correct ? applyCorrectAnswerReward(prev, CORRECT_ANSWER_COINS) : applyWrongAnswerConsequence(prev)
    })
    poll()
  }

  function handleSelectPad(padId: string) {
    setBattlefield((prev) => {
      if (!prev) return prev
      const existing = prev.towers.find((t) => t.padId === padId)
      if (existing) {
        setSelectedPadId(padId)
        return prev
      }
      const next = placeTower(prev, padId, selectedTowerType)
      setSelectedPadId(null)
      return next
    })
  }

  function handleUpgrade() {
    if (!selectedPadId) return
    setBattlefield((prev) => (prev ? upgradeTower(prev, selectedPadId) : prev))
  }

  function handleNextWave() {
    setWaveMessage(null)
    setBattlefield((prev) => (prev ? startWave(advanceToNextWave(prev)) : prev))
  }

  async function handleTogglePause() {
    await togglePause()
  }

  async function handleExit() {
    await exit(onExit)
  }

  if (!difficulty) {
    return <DifficultyPicker onStart={handleStart} />
  }

  if (error && !sessionState) return <GameV2Error description={error} onRetry={poll} />
  if (!sessionState || !battlefield) return <GameV2Loading label="Preparing the battlefield..." />
  if (result) return <GameResultsScreen result={result} onPlayAgain={onPlayAgain} onExit={onExit} />
  // Every question answered, but the battle isn't over yet (a shorter
  // Question Set than the wave count) -- keep the battlefield on screen
  // so the player finishes the fight instead of getting bounced straight
  // to a loading spinner.
  const battleStillInPlay = !battlefield.gameOver && !battlefield.victory
  if (sessionState.status === 'COMPLETED' && !battleStillInPlay) return <GameV2Loading label="Calculating your results..." />

  if (battlefield.gameOver) {
    return (
      <GameV2Card padding="lg" className="max-w-lg w-full mx-auto text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {'\u{1F6E1}️'}
        </div>
        <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Your fort fell</h2>
        <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
          You made it to wave {battlefield.wave} of {TOTAL_WAVES}. Answer more questions correctly next time to keep the defenses strong!
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <GameV2Button
            variant="spark"
            fullWidth
            onClick={() => {
              setDifficulty(null)
              setBattlefield(null)
            }}
          >
            Try Again
          </GameV2Button>
          <GameV2Button variant="ghost" fullWidth onClick={handleExit}>
            Exit
          </GameV2Button>
        </div>
      </GameV2Card>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 px-4 py-6">
      <div className="w-full flex items-center justify-between">
        <button onClick={handleExit} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2coral-500">
          Exit
        </button>
        <div className="flex items-center gap-3 text-sm font-extrabold text-gamev2ink-800 dark:text-white">
          <span>
            Wave {battlefield.wave}/{TOTAL_WAVES}
          </span>
          <span className="flex items-center gap-1">🪙 {battlefield.coins}</span>
          <span className="flex items-center gap-1">
            {'❤️'} {battlefield.baseHealth}/{battlefield.maxBaseHealth}
          </span>
        </div>
        <button onClick={handleTogglePause} className="text-sm font-bold text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white">
          {sessionState.status === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
      </div>

      <Battlefield state={battlefield} impacts={impacts} selectedPadId={selectedPadId} onSelectPad={handleSelectPad} />

      <TowerShop
        state={battlefield}
        selectedTowerType={selectedTowerType}
        onSelectTowerType={setSelectedTowerType}
        selectedPadId={selectedPadId}
        onUpgrade={handleUpgrade}
        onClearSelection={() => setSelectedPadId(null)}
      />

      {sessionState.status === 'PAUSED' && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2ink-800 dark:text-white">Game Paused</p>
          <GameV2Button variant="spark" size="md" className="mt-3" onClick={handleTogglePause}>
            Resume
          </GameV2Button>
        </GameV2Card>
      )}

      {battlefield.victory && (
        <GameV2Card padding="md" className="w-full text-center">
          <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">
            {'\u{1F3C6}'} Fort defended! Finish any remaining questions to see your full results.
          </p>
        </GameV2Card>
      )}

      {!battlefield.waveActive && !battlefield.gameOver && !battlefield.victory && waveMessage && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <GameV2Card padding="md" className="w-full text-center">
            <p className="font-extrabold text-gamev2mint-600 dark:text-gamev2mint-400">{waveMessage}</p>
            <GameV2Button variant="spark" size="md" className="mt-3" onClick={handleNextWave}>
              Start Wave {battlefield.wave + 1}
            </GameV2Button>
          </GameV2Card>
        </motion.div>
      )}

      {showQuestion && sessionState.question && sessionState.status === 'ACTIVE' && (
        <div className="w-full">
          <QuestionOverlay
            sessionId={sessionId}
            question={sessionState.question}
            questionIndex={sessionState.currentIndex}
            remainingSeconds={sessionState.remainingSeconds}
            onResult={handleAnswerResult}
          />
        </div>
      )}
    </div>
  )
}
