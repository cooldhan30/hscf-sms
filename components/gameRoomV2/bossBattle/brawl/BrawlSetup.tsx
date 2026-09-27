'use client'

import { useEffect, useRef, useState } from 'react'
import { FiShield } from 'react-icons/fi'
import { GiCrossedSwords } from 'react-icons/gi'
import { ARENAS, WORLD_W, WORLD_H, type ArenaId, type BrawlDifficulty } from '@/lib/gameRoomV2/bossBattle/brawl'
import { paintArena } from './scenery'

// Boss Battle's start card: pick an arena (each shows a painted preview
// of the real arena) and a difficulty. Tamizhi card styling -- white,
// rounded-3xl, primary button, stone borders -- over the arena itself.

const DIFFICULTIES: { id: BrawlDifficulty; name: string; hint: string }[] = [
  { id: 'easy', name: 'Easy', hint: 'Fewer, softer foes' },
  { id: 'normal', name: 'Normal', hint: 'A fair fight' },
  { id: 'hard', name: 'Hard', hint: 'Fierce hordes' },
]

function ArenaThumb({ id }: { id: ArenaId }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const w = 320
    const h = 190
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    if (!g) return
    const arena = ARENAS.find((a) => a.id === id)!
    // Frame the whole arena plus a little scenery.
    const vw = WORLD_W + 240
    const vh = WORLD_H + 240
    const k = Math.max(w / vw, h / vh)
    g.scale(k, k)
    g.translate(w / (2 * k) - WORLD_W / 2, h / (2 * k) - WORLD_H / 2)
    paintArena(g, arena)
  }, [id])
  return <canvas ref={ref} className="block w-full h-full object-cover" aria-hidden />
}

export function BrawlSetup({ arenaId, onArena, onStart }: { arenaId: ArenaId; onArena: (id: ArenaId) => void; onStart: (d: BrawlDifficulty) => void }) {
  const [difficulty, setDifficulty] = useState<BrawlDifficulty>('normal')
  const arena = ARENAS.find((a) => a.id === arenaId)!
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-stone-900/35 backdrop-blur-[2px]">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-white p-4 sm:p-6 animate-gamev2-pop-in">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center">
              <GiCrossedSwords className="w-7 h-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-terracotta-600">Game Room · Boss Battle</p>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 leading-tight">Rise against the Irul King</h1>
              <p className="font-tamil text-sm font-semibold text-primary-700">இருள் அரசனை வெல்வோம்</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Move your hero, and your weapons strike on their own. Survive four waves, collect sparks to level up, and defeat the bosses. Tamil challenges at each checkpoint heal you and unlock golden upgrades.
          </p>

          <h2 className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Choose your arena</h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Arena">
            {ARENAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === arenaId}
                onClick={() => onArena(a.id)}
                className={`group text-left rounded-2xl overflow-hidden border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${a.id === arenaId ? 'border-primary-600 ring-2 ring-primary-200' : 'border-stone-200 hover:border-primary-300'}`}
              >
                <span className="block aspect-[16/10] bg-stone-100">
                  <ArenaThumb id={a.id} />
                </span>
                <span className="block px-2 py-1.5">
                  <span className="block text-sm font-extrabold text-stone-900 leading-tight">{a.name}</span>
                  <span className="block font-tamil text-[11px] text-stone-500 leading-tight">{a.tamilName}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">{arena.blurb}</p>

          <h2 className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Difficulty</h2>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={difficulty === d.id}
                onClick={() => setDifficulty(d.id)}
                className={`min-h-[56px] rounded-2xl border-2 px-2 py-1.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${difficulty === d.id ? 'border-primary-600 bg-primary-50' : 'border-stone-200 hover:border-primary-300'}`}
              >
                <span className="block font-extrabold text-stone-900">{d.name}</span>
                <span className="block text-[11px] text-stone-500">{d.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
            <p className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2">
              <span className="font-bold text-stone-800">Keyboard:</span> WASD or arrow keys to move · Space to dash · Esc to pause
            </p>
            <p className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2">
              <span className="font-bold text-stone-800">Touch:</span> drag anywhere to move · tap the shield to dash
            </p>
          </div>

          <button
            type="button"
            onClick={() => onStart(difficulty)}
            className="mt-4 w-full min-h-[56px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white text-lg font-extrabold shadow-teal inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-400"
          >
            <FiShield className="w-5 h-5" aria-hidden /> Enter the arena
          </button>
        </div>
      </div>
    </div>
  )
}
