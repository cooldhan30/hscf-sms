'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playSound } from '@/lib/gameRoom/sound'
import type { CrosswordPuzzle } from '@/lib/gameRoom/modules/tamilWordFormation/crossword'
import { buildGridCells, buildWheelLetters, type WheelLetter } from '@/lib/gameRoom/modules/tamilWordFormation/crosswordBoard'

interface TamilCrosswordGameProps {
  level: number
  puzzle: CrosswordPuzzle
  onLevelComplete: (wordsCompleted: number, hintsUsed: number) => Promise<void>
}

const CELL_PX = 50
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
  const [justFilledCells, setJustFilledCells] = useState<Set<string>>(new Set())
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
  // Tiles sit at 70% of the way to the edge -- leaves a visible ring of
  // the base plate around each tile (was 78%, which let a tile's own
  // corner poke past the plate's edge on some angles since the tile is
  // a similar size to the remaining margin).
  const TILE_DISTANCE_FRACTION = 0.68

  function tileAtPoint(clientX: number, clientY: number): string | null {
    if (!wheelRef.current) return null
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const radius = (rect.width / 2) * TILE_DISTANCE_FRACTION
    const hitRadius = (rect.width / WHEEL_SIZE_PX) * (WHEEL_TILE_PX / 2 + 14)

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
    const newCellKeys: string[] = []
    for (let i = 0; i < match.units.length; i++) {
      const row = match.direction === 'down' ? match.row + i : match.row
      const col = match.direction === 'across' ? match.col + i : match.col
      newCellKeys.push(`${row},${col}`)
    }
    setFilledCells((prev) => new Set([...Array.from(prev), ...newCellKeys]))
    setJustFilledCells(new Set(newCellKeys))
    setTimeout(() => setJustFilledCells(new Set()), 600)

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
      className="max-w-md mx-auto px-4 py-5 select-none"
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t) handlePointerMove(t.clientX, t.clientY)
      }}
      onTouchEnd={handlePointerUp}
    >
      <div className="rounded-3xl p-5 flex flex-col items-center gap-4 shadow-xl shadow-primary-900/5 dark:shadow-black/30 border border-primary-100 dark:border-primary-950 bg-gradient-to-b from-primary-50 to-white dark:from-stone-900 dark:to-stone-950">
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-primary-900 dark:text-primary-200">
            எழுத்துகளை இணைத்து சொற்களை உருவாக்குங்கள்!
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-700 dark:bg-primary-600 px-3 py-1 rounded-full">
            <span>Level {level}</span>
            <span className="opacity-60">·</span>
            <span>{solvedWords.size} / {puzzle.words.length}</span>
          </div>
        </div>

        {/* Crossword grid -- every cell always has a visible border, so
            the puzzle's shape reads clearly even before anything is
            filled in. */}
        <div
          className="relative shrink-0 rounded-2xl p-2 bg-white/60 dark:bg-stone-950/40 shadow-inner"
          style={{ width: gridWidth + 16, height: gridHeight + 16 }}
        >
          {gridCells.map((cell) => {
            const key = `${cell.row},${cell.col}`
            const isFilled = filledCells.has(key)
            const justFilled = justFilledCells.has(key)
            return (
              <motion.div
                key={key}
                initial={false}
                animate={justFilled ? { scale: [0.6, 1.15, 1], rotate: [0, -4, 0] } : { scale: 1 }}
                transition={{ duration: 0.45 }}
                className={`absolute flex items-center justify-center rounded-xl text-xl font-black ${
                  isFilled
                    ? 'bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-500 dark:to-primary-800 text-white shadow-md shadow-primary-900/30'
                    : 'bg-white dark:bg-stone-900 border-2 border-dashed border-primary-200 dark:border-primary-900 text-transparent'
                }`}
                style={{
                  left: (cell.col - minCol) * CELL_PX + 8,
                  top: (cell.row - minRow) * CELL_PX + 8,
                  width: CELL_PX - 6,
                  height: CELL_PX - 6,
                }}
              >
                {isFilled ? cell.unit : ''}
              </motion.div>
            )
          })}
        </div>

        <div className="min-h-[2.25rem] flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            {justSolved ? (
              <motion.div
                key="solved"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-white dark:bg-stone-900 px-4 py-1.5 rounded-full shadow-md"
              >
                <span className="text-lg font-black text-primary-700 dark:text-primary-400">{justSolved.word}</span>
                {justSolved.hintEmoji && <span className="text-xl">{justSolved.hintEmoji}</span>}
                <span className="text-sm text-stone-500 dark:text-stone-400">{justSolved.meaningEnglish}</span>
              </motion.div>
            ) : (
              <motion.div
                key="hints"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {puzzle.words
                  .filter((w) => !solvedWords.has(w.word))
                  .map((w) => (
                    <button
                      key={w.word}
                      type="button"
                      onClick={() => handleHint(w.word)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 shadow-sm hover:shadow-md hover:text-amber-600 dark:hover:text-amber-400 transition-all"
                    >
                      {revealedHints.has(w.word) ? `${w.hintEmoji ?? ''} ${w.meaningEnglish}` : `💡 ${w.units.length}`}
                    </button>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected-letters preview */}
        <div className="min-h-[2.75rem] flex items-center justify-center gap-1.5 flex-wrap">
          {selectedIds.map((id) => (
            <motion.span
              key={id}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-md text-lg font-black text-white"
            >
              {wheelLetters.find((w) => w.wheelId === id)?.unit}
            </motion.span>
          ))}
        </div>

        {/* Circular letter wheel */}
        <div className="w-full flex justify-center py-1" style={{ maxWidth: WHEEL_SIZE_PX }}>
          <motion.div
            ref={wheelRef}
            animate={shake ? { x: [0, -8, 8, -8, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="relative rounded-full w-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-950 dark:to-primary-900 shadow-inner border-4 border-white dark:border-stone-800 ring-1 ring-primary-200 dark:ring-primary-900"
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
                  className={`absolute flex items-center justify-center rounded-full text-xl sm:text-2xl font-black touch-none transition-transform ${
                    isSelected
                      ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-lg scale-110 ring-2 ring-white'
                      : 'bg-white dark:bg-stone-900 text-primary-800 dark:text-primary-300 shadow-md'
                  }`}
                  style={{
                    width: '24%',
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
    </div>
  )
}
