'use client'

import { FiPause, FiPlay, FiVolume2, FiVolumeX, FiX, FiHeart } from 'react-icons/fi'
import { GameV2Timer, GameV2XPDisplay, GameV2CoinDisplay, GameV2ProgressBar } from '@/components/gameRoomV2'

// The persistent in-game HUD strip -- progress, timer, streak, lives,
// XP/coins, and the Pause/Sound/Exit controls -- shared by every game
// engine's play screen. An engine mounts this alongside
// QuestionOverlay/its own board rendering; the HUD itself has zero
// opinion about what kind of game is running underneath it.
export function GameHUD({
  currentIndex,
  totalQuestions,
  remainingSeconds,
  questionTimeLimitSeconds,
  currentStreak,
  lives,
  maxLives,
  xpEarned,
  coinsEarned,
  paused,
  soundEnabled,
  onTogglePause,
  onToggleSound,
  onExit,
}: {
  currentIndex: number
  totalQuestions: number
  remainingSeconds: number | null
  questionTimeLimitSeconds: number
  currentStreak: number
  lives: number
  maxLives: number
  xpEarned: number
  coinsEarned: number
  paused: boolean
  soundEnabled: boolean
  onTogglePause: () => void
  onToggleSound: () => void
  onExit: () => void
}) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit game"
          className="p-2 rounded-xl text-gamev2ink-400 hover:text-gamev2coral-500 hover:bg-gamev2coral-50 dark:hover:bg-gamev2coral-500/10 transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {remainingSeconds !== null && <GameV2Timer secondsRemaining={remainingSeconds} totalSeconds={questionTimeLimitSeconds} />}
          {maxLives > 0 && (
            <div className="flex items-center gap-0.5" aria-label={`${lives} of ${maxLives} lives remaining`}>
              {Array.from({ length: maxLives }, (_, i) => (
                <FiHeart key={i} className={`w-4 h-4 ${i < lives ? 'text-gamev2coral-500 fill-current' : 'text-gamev2ink-200 dark:text-gamev2ink-700'}`} />
              ))}
            </div>
          )}
          {currentStreak > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gamev2spark-100 dark:bg-gamev2spark-500/20 text-gamev2spark-700 dark:text-gamev2spark-300">
              🔥 {currentStreak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            aria-pressed={!soundEnabled}
            className="p-2 rounded-xl text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white hover:bg-gamev2ink-100 dark:hover:bg-gamev2ink-800 transition-colors"
          >
            {soundEnabled ? <FiVolume2 className="w-4 h-4" /> : <FiVolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? 'Resume game' : 'Pause game'}
            className="p-2 rounded-xl text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white hover:bg-gamev2ink-100 dark:hover:bg-gamev2ink-800 transition-colors"
          >
            {paused ? <FiPlay className="w-4 h-4" /> : <FiPause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <GameV2ProgressBar value={currentIndex} max={totalQuestions} label={`Question ${Math.min(currentIndex + 1, totalQuestions)} of ${totalQuestions}`} />

      <div className="flex items-center justify-center gap-2">
        <GameV2XPDisplay xp={xpEarned} />
        <GameV2CoinDisplay coins={coinsEarned} />
      </div>
    </div>
  )
}
