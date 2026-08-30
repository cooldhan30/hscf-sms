'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import type { CrosswordPuzzle } from '@/lib/gameRoom/modules/tamilWordFormation/crossword'
import { buildGridCells, buildWheelLetters, type WheelLetter } from '@/lib/gameRoom/modules/tamilWordFormation/crosswordBoard'

interface TamilCrosswordGameProps {
  level: number
  puzzle: CrosswordPuzzle
  onLevelComplete: (wordsCompleted: number, hintsUsed: number) => Promise<void>
}

const CELL_PX = 44
const WHEEL_RADIUS_PX = 90
const WHEEL_TILE_PX = 52

// Wordscapes-style crossword: a grid of intersecting target words
// (built from curated puzzle data -- see crossword.ts for why these
// are hand-curated rather than generated) plus a circular "letter
// wheel" the player swipes across to spell a word. Swiping over a
// wheel tile selects it (in order); lifting the finger/mouse submits
// the word if it matches one of the puzzle's remaining words, and the
// tiles animate into their crossword cells on success (or the
// selection is rejected with a shake on failure). This is a genuinely
// different interaction from the tap-one-at-a-time TamilWordFormationGame
// (kept as its own component; not a variant of it) -- selection here
// is continuous-pointer-drag over a circular layout, not discrete taps
// on a linear tray.
export function TamilCrosswordGame({ level, puzzle, onLevelComplete }: TamilCrosswordGameProps) {
  const [gridCells] = useState(() => buildGridCells(puzzle))
  const [wheelLetters] = useState<WheelLetter[]>(() => buildWheelLetters(puzzle))
  const [solvedWords, setSolvedWords] = useState<Set<string>>(new Set())
  const [filledCells, setFilledCells] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [shake, setShake] = useState(false)
  const [totalHintsUsed, setTotalHintsUsed] = useState(0)
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set())
  const [justSolved, setJustSolved] = useState<{ word: string; meaningEnglish: string; hintEmoji: string | null } | null>(null)
  const wheelRef = useRef<HTMLDivElement | null>(null)

  const minRow = Math.min(...gridCells.map((c) => c.row))
  const minCol = Math.min(...gridCells.map((c) => c.col))

  const wheelPositions = wheelLetters.map((_, i) => {
    const angle = (i / wheelLetters.length) * 2 * Math.PI - Math.PI / 2
    return { x: Math.cos(angle) * WHEEL_RADIUS_PX, y: Math.sin(angle) * WHEEL_RADIUS_PX }
  })

  function tileAtPoint(clientX: number, clientY: number): string | null {
    if (!wheelRef.current) return null
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    for (let i = 0; i < wheelLetters.length; i++) {
      const tileX = centerX + wheelPositions[i].x
      const tileY = centerY + wheelPositions[i].y
      const dist = Math.hypot(clientX - tileX, clientY - tileY)
      if (dist <= WHEEL_TILE_PX / 2 + 12) return wheelLetters[i].wheelId
    }
    return null
  }

  function handlePointerDown(clientX: number, clientY: number) {
    const wheelId = tileAtPoint(clientX, clientY)
    if (!wheelId) return
    setIsDragging(true)
    setSelectedIds([wheelId])
  }

  function handlePointerMove(clientX: number, clientY: number) {
    if (!isDragging) return
    const wheelId = tileAtPoint(clientX, clientY)
    if (!wheelId || selectedIds.includes(wheelId)) return
    setSelectedIds((prev) => [...prev, wheelId])
  }

  function handlePointerUp() {
    if (!isDragging) return
    setIsDragging(false)
    submitSelection()
  }

  function submitSelection() {
    const attemptUnits = selectedIds.map((id) => wheelLetters.find((w) => w.wheelId === id)!.unit)
    setSelectedIds([])

    if (attemptUnits.length === 0) return

    const match = puzzle.words.find(
      (w) => !solvedWords.has(w.word) && w.units.length === attemptUnits.length && w.units.every((u, i) => u === attemptUnits[i])
    )

    if (!match) {
      playSound('incorrect')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }

    playSound('correct')
    const newFilled = new Set(filledCells)
    for (let i = 0; i < match.units.length; i++) {
      const row = match.direction === 'down' ? match.row + i : match.row
      const col = match.direction === 'across' ? match.col + i : match.col
      newFilled.add(`${row},${col}`)
    }
    setFilledCells(newFilled)

    const newSolved = new Set(solvedWords)
    newSolved.add(match.word)
    setSolvedWords(newSolved)
    setJustSolved({ word: match.word, meaningEnglish: match.meaningEnglish, hintEmoji: match.hintEmoji })
    setTimeout(() => setJustSolved(null), 1400)

    if (newSolved.size === puzzle.words.length) {
      playSound('complete')
      onLevelComplete(newSolved.size, totalHintsUsed)
    }
  }

  function handleHint(word: string) {
    if (revealedHints.has(word)) return
    setRevealedHints((prev) => new Set(prev).add(word))
    setTotalHintsUsed((n) => n + 1)
  }

  const gridWidth = puzzle.cols * CELL_PX
  const gridHeight = puzzle.rows * CELL_PX

  return (
    <div
      className="max-w-lg mx-auto px-4 py-6 space-y-8 select-none"
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t) handlePointerMove(t.clientX, t.clientY)
      }}
      onTouchEnd={handlePointerUp}
    >
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
          எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்!
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Level {level} · {solvedWords.size} / {puzzle.words.length}
        </p>
      </div>

      {/* Crossword grid */}
      <div className="relative mx-auto" style={{ width: gridWidth, height: gridHeight }}>
        {gridCells.map((cell) => {
          const key = `${cell.row},${cell.col}`
          const isFilled = filledCells.has(key)
          return (
            <div
              key={key}
              className={`absolute flex items-center justify-center border-2 text-lg font-black rounded-md ${
                isFilled
                  ? 'border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-transparent'
              }`}
              style={{
                left: (cell.col - minCol) * CELL_PX,
                top: (cell.row - minRow) * CELL_PX,
                width: CELL_PX - 4,
                height: CELL_PX - 4,
              }}
            >
              {isFilled ? cell.unit : ''}
            </div>
          )
        })}
      </div>

      {/* Hints for unsolved words */}
      <div className="flex flex-wrap justify-center gap-3">
        {puzzle.words
          .filter((w) => !solvedWords.has(w.word))
          .map((w) => (
            <button
              key={w.word}
              type="button"
              onClick={() => handleHint(w.word)}
              className="text-xs px-3 py-1.5 rounded-full border border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-primary-400"
            >
              {revealedHints.has(w.word) ? `${w.hintEmoji ?? ''} ${w.meaningEnglish}` : `💡 Hint (${w.units.length})`}
            </button>
          ))}
      </div>

      {justSolved && (
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-primary-700 dark:text-primary-400">{justSolved.word}</p>
          {justSolved.hintEmoji && <p className="text-3xl">{justSolved.hintEmoji}</p>}
          <p className="text-sm text-stone-500 dark:text-stone-400">{justSolved.meaningEnglish}</p>
        </div>
      )}

      {/* Selected-letters preview */}
      <div className="min-h-[3rem] flex items-center justify-center gap-1 flex-wrap">
        {selectedIds.map((id) => (
          <span
            key={id}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-400 text-lg font-black text-amber-800 dark:text-amber-300"
          >
            {wheelLetters.find((w) => w.wheelId === id)?.unit}
          </span>
        ))}
      </div>

      {/* Circular letter wheel */}
      <motion.div
        ref={wheelRef}
        animate={shake ? { x: [0, -8, 8, -8, 0] } : {}}
        transition={{ duration: 0.3 }}
        className="relative mx-auto rounded-full bg-primary-50 dark:bg-primary-950/40 border-2 border-primary-200 dark:border-primary-900"
        style={{ width: WHEEL_RADIUS_PX * 2 + WHEEL_TILE_PX, height: WHEEL_RADIUS_PX * 2 + WHEEL_TILE_PX }}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) handlePointerDown(t.clientX, t.clientY)
        }}
      >
        {wheelLetters.map((letter, i) => {
          const isSelected = selectedIds.includes(letter.wheelId)
          return (
            <div
              key={letter.wheelId}
              className={`absolute flex items-center justify-center rounded-full border-2 text-2xl font-black shadow-md touch-none ${
                isSelected
                  ? 'border-amber-500 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 scale-110'
                  : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300'
              }`}
              style={{
                width: WHEEL_TILE_PX,
                height: WHEEL_TILE_PX,
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${wheelPositions[i].x}px), calc(-50% + ${wheelPositions[i].y}px))`,
              }}
            >
              {letter.unit}
            </div>
          )
        })}
      </motion.div>
      <p className="text-center text-xs text-stone-400 dark:text-stone-500">
        Swipe across the letters to form a word
      </p>
    </div>
  )
}
