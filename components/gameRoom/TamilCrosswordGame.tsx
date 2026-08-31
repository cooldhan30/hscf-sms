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

const CELL_PX = 48
const WHEEL_SIZE_PX = 220
const WHEEL_TILE_PX = 56

// Wordscapes-style crossword: a grid of intersecting target words
// (built from curated puzzle data -- see crossword.ts for why these
// are hand-curated rather than generated) plus a circular "letter
// wheel" the player swipes across to spell a word. Swiping over a
// wheel tile selects it (in order); lifting the finger/mouse submits
// the word if it matches one of the puzzle's remaining words, and the
// tiles animate into their crossword cells on success (or the
// selection is rejected with a shake on failure).
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

  // Positions are fractions of the wheel's OWN rendered radius (0..1),
  // not fixed pixels -- the wheel itself scales responsively (w-full +
  // aspect-ratio) to fit narrow screens, so tile placement and hit-
  // testing both need to read the wheel's actual current size at
  // pointer time rather than assume a constant.
  const wheelPositionFractions = wheelLetters.map((_, i) => {
    const angle = (i / wheelLetters.length) * 2 * Math.PI - Math.PI / 2
    return { fx: Math.cos(angle), fy: Math.sin(angle) }
  })
  // Tiles sit at 78% of the way to the edge, leaving room for the
  // tile's own radius so it doesn't clip outside the circle.
  const TILE_DISTANCE_FRACTION = 0.78

  function tileAtPoint(clientX: number, clientY: number): string | null {
    if (!wheelRef.current) return null
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const radius = (rect.width / 2) * TILE_DISTANCE_FRACTION
    const hitRadius = (rect.width / WHEEL_SIZE_PX) * (WHEEL_TILE_PX / 2 + 12)

    for (let i = 0; i < wheelLetters.length; i++) {
      const tileX = centerX + wheelPositionFractions[i].fx * radius
      const tileY = centerY + wheelPositionFractions[i].fy * radius
      const dist = Math.hypot(clientX - tileX, clientY - tileY)
      if (dist <= hitRadius) return wheelLetters[i].wheelId
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
      className="max-w-md mx-auto px-4 py-4 flex flex-col items-center gap-4 select-none"
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t) handlePointerMove(t.clientX, t.clientY)
      }}
      onTouchEnd={handlePointerUp}
    >
      <div className="text-center space-y-0.5">
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
          எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்!
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Level {level} · {solvedWords.size} / {puzzle.words.length}
        </p>
      </div>

      {/* Crossword grid -- every cell always has a visible border, so
          the puzzle's shape reads clearly even before anything is
          filled in (an unfilled cell used to render fully invisible,
          which made the grid look broken/incomplete). */}
      <div className="relative shrink-0" style={{ width: gridWidth, height: gridHeight }}>
        {gridCells.map((cell) => {
          const key = `${cell.row},${cell.col}`
          const isFilled = filledCells.has(key)
          return (
            <div
              key={key}
              className={`absolute flex items-center justify-center border-2 rounded-lg text-xl font-black transition-colors ${
                isFilled
                  ? 'border-primary-700 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-800 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-transparent'
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

      <div className="min-h-[2.25rem] flex items-center justify-center">
        {justSolved ? (
          <div className="text-center">
            <span className="text-lg font-black text-primary-700 dark:text-primary-400">{justSolved.word}</span>
            {justSolved.hintEmoji && <span className="text-xl ml-1.5">{justSolved.hintEmoji}</span>}
            <span className="text-sm text-stone-500 dark:text-stone-400 ml-1.5">{justSolved.meaningEnglish}</span>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {puzzle.words
              .filter((w) => !solvedWords.has(w.word))
              .map((w) => (
                <button
                  key={w.word}
                  type="button"
                  onClick={() => handleHint(w.word)}
                  className="text-xs px-3 py-1 rounded-full border border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-primary-400"
                >
                  {revealedHints.has(w.word) ? `${w.hintEmoji ?? ''} ${w.meaningEnglish}` : `💡 (${w.units.length})`}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Selected-letters preview */}
      <div className="min-h-[2.5rem] flex items-center justify-center gap-1.5 flex-wrap">
        {selectedIds.map((id) => (
          <span
            key={id}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 border-2 border-amber-400 text-lg font-black text-amber-800 dark:text-amber-300"
          >
            {wheelLetters.find((w) => w.wheelId === id)?.unit}
          </span>
        ))}
      </div>

      {/* Circular letter wheel -- sized in a fixed px box, but that
          box itself scales down via CSS on narrow viewports (see the
          wrapper's max-width/aspect-ratio) so it never overflows a
          phone-width screen. */}
      <div className="w-full flex justify-center" style={{ maxWidth: WHEEL_SIZE_PX }}>
        <motion.div
          ref={wheelRef}
          animate={shake ? { x: [0, -8, 8, -8, 0] } : {}}
          transition={{ duration: 0.3 }}
          className="relative rounded-full bg-primary-50 dark:bg-primary-950/40 border-2 border-primary-200 dark:border-primary-900 w-full"
          style={{ aspectRatio: '1 / 1' }}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0]
            if (t) handlePointerDown(t.clientX, t.clientY)
          }}
        >
          {wheelLetters.map((letter, i) => {
            const isSelected = selectedIds.includes(letter.wheelId)
            // Tile center as a percentage of the wheel's own box --
            // scales correctly at any rendered size since it never
            // references a fixed pixel constant.
            const leftPct = 50 + wheelPositionFractions[i].fx * (TILE_DISTANCE_FRACTION / 2) * 100
            const topPct = 50 + wheelPositionFractions[i].fy * (TILE_DISTANCE_FRACTION / 2) * 100
            return (
              <div
                key={letter.wheelId}
                className={`absolute flex items-center justify-center rounded-full border-2 text-xl sm:text-2xl font-black shadow-md touch-none ${
                  isSelected
                    ? 'border-amber-500 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 scale-110'
                    : 'border-primary-700 dark:border-primary-400 bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300'
                }`}
                style={{
                  width: '26%',
                  aspectRatio: '1 / 1',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {letter.unit}
              </div>
            )
          })}
        </motion.div>
      </div>
      <p className="text-center text-xs text-stone-400 dark:text-stone-500">
        Swipe across the letters to form a word
      </p>
    </div>
  )
}
