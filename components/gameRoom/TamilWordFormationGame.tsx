'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiDelete } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { playSound } from '@/lib/gameRoom/sound'
import type { WordPuzzle } from '@/lib/gameRoom/modules/tamilWordFormation/puzzle'

interface TamilWordFormationGameProps {
  level: number
  puzzles: WordPuzzle[]
  onLevelComplete: (wordsCompleted: number, hintsUsed: number) => Promise<void>
}

interface TileState {
  unit: string
  // Distinguishes two identical-looking tiles (e.g. two "ம" tiles in
  // one puzzle) as separate selectable objects -- selection tracks
  // this id, not the unit text, so using one copy never accidentally
  // consumes the other.
  tileId: string
  used: boolean
}

// Tap-a-letter-then-tap-the-next-letter word formation -- per spec,
// "Tap → Tap → Tap → Form Word" is the primary interaction (easier for
// Nilai 1 than precise dragging), so this is a selection game like
// TamilPairMatchGame, not a drag game. One word is active at a time;
// completing it advances to the next word in the level automatically
// (no teacher intervention needed between words, per spec). The parent
// (WordFormationLevelClient) owns level-wide state (which word index,
// total hints used) and calls onLevelComplete once all words in the
// level are done.
export function TamilWordFormationGame({ level, puzzles, onLevelComplete }: TamilWordFormationGameProps) {
  const [wordIndex, setWordIndex] = useState(0)
  const [tiles, setTiles] = useState<TileState[]>(() => makeTiles(puzzles[0]))
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]) // tileIds in selection order
  const [shake, setShake] = useState(false)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [hintsUsedThisWord, setHintsUsedThisWord] = useState(false)
  const [totalHintsUsed, setTotalHintsUsed] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [justCompletedWord, setJustCompletedWord] = useState<WordPuzzle | null>(null)

  const currentPuzzle = puzzles[wordIndex]
  const isLastWord = wordIndex === puzzles.length - 1

  function makeTiles(puzzle: WordPuzzle): TileState[] {
    return puzzle.tileUnits.map((unit, i) => ({ unit, tileId: `${unit}-${i}`, used: false }))
  }

  function selectedWord(): string[] {
    return selectedOrder.map((tileId) => tiles.find((t) => t.tileId === tileId)!.unit)
  }

  function handleTapTile(tileId: string) {
    const tile = tiles.find((t) => t.tileId === tileId)
    // Capped at the target word's own length -- the selected-word
    // display area is exactly that many boxes, so accepting more taps
    // would silently mark extra tiles "used" with nowhere to show them.
    if (!tile || tile.used || selectedOrder.length >= currentPuzzle.targetUnits.length) return

    setTiles((prev) => prev.map((t) => (t.tileId === tileId ? { ...t, used: true } : t)))
    setSelectedOrder((prev) => [...prev, tileId])
    playSound('correct')
  }

  function handleBackspace() {
    if (selectedOrder.length === 0) return
    const lastTileId = selectedOrder[selectedOrder.length - 1]
    setSelectedOrder((prev) => prev.slice(0, -1))
    setTiles((prev) => prev.map((t) => (t.tileId === lastTileId ? { ...t, used: false } : t)))
  }

  function handleClear() {
    setSelectedOrder([])
    setTiles((prev) => prev.map((t) => ({ ...t, used: false })))
  }

  function handleHint() {
    setShowHint(true)
    setHintsUsedThisWord(true)
    setTotalHintsUsed((n) => n + 1)
  }

  async function handleSubmit() {
    const attempt = selectedWord()
    const isCorrect = attempt.length === currentPuzzle.targetUnits.length && attempt.every((u, i) => u === currentPuzzle.targetUnits[i])

    if (!isCorrect) {
      playSound('incorrect')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }

    playSound('complete')
    const newWordsCompleted = wordsCompleted + 1
    setWordsCompleted(newWordsCompleted)
    setJustCompletedWord(currentPuzzle)

    if (isLastWord) {
      await onLevelComplete(newWordsCompleted, totalHintsUsed)
      return
    }

    // Brief vocabulary card, then advance automatically -- per spec,
    // "continue automatically where appropriate," no teacher click
    // needed between words.
    setTimeout(() => {
      const nextIndex = wordIndex + 1
      setWordIndex(nextIndex)
      setTiles(makeTiles(puzzles[nextIndex]))
      setSelectedOrder([])
      setShowHint(false)
      setHintsUsedThisWord(false)
      setJustCompletedWord(null)
    }, 1600)
  }

  if (justCompletedWord && !isLastWord) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-3xl">✅</p>
        <p className="text-3xl font-black text-primary-700 dark:text-primary-400">{justCompletedWord.word}</p>
        {justCompletedWord.hintEmoji && <p className="text-4xl">{justCompletedWord.hintEmoji}</p>}
        <p className="text-sm text-stone-500 dark:text-stone-400">{justCompletedWord.meaningEnglish}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
          எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்!
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Level {level} · {wordsCompleted} / {puzzles.length}
        </p>
      </div>

      <motion.div
        animate={shake ? { x: [0, -8, 8, -8, 0] } : {}}
        transition={{ duration: 0.3 }}
        className="min-h-[4rem] flex items-center justify-center gap-2 flex-wrap p-3 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700"
      >
        {currentPuzzle.targetUnits.map((_, i) => {
          const tileId = selectedOrder[i]
          const unit = tileId ? tiles.find((t) => t.tileId === tileId)?.unit : null
          return (
            <span
              key={i}
              className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-2xl font-black text-primary-800 dark:text-primary-300"
            >
              {unit ?? ''}
            </span>
          )
        })}
      </motion.div>

      {showHint && (
        <div className="text-center space-y-1">
          {currentPuzzle.hintEmoji && <p className="text-3xl">{currentPuzzle.hintEmoji}</p>}
          <p className="text-sm text-stone-500 dark:text-stone-400">{currentPuzzle.meaningEnglish}</p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.tileId}
            type="button"
            onClick={() => handleTapTile(tile.tileId)}
            disabled={tile.used}
            className={`w-16 h-16 flex items-center justify-center rounded-2xl border-2 text-3xl font-black select-none transition-transform ${
              tile.used
                ? 'opacity-30 border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-stone-400 dark:text-stone-600'
                : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300 shadow-md hover:scale-105'
            }`}
          >
            {tile.unit}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button variant="outline" icon={<FiDelete />} onClick={handleBackspace} disabled={selectedOrder.length === 0}>
          நீக்கு
        </Button>
        <Button variant="outline" onClick={handleClear} disabled={selectedOrder.length === 0}>
          Clear
        </Button>
        {!showHint && !hintsUsedThisWord && (
          <Button variant="outline" onClick={handleHint}>
            💡 Hint
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={selectedOrder.length !== currentPuzzle.targetUnits.length}
        >
          சொல்லை சரிபார்க்கவும் ✓
        </Button>
      </div>
    </div>
  )
}
