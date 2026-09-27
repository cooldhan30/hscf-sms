'use client'

import { useEffect, useRef, useState } from 'react'
import { FiShield } from 'react-icons/fi'
import { GiCrossedSwords } from 'react-icons/gi'
import { ARENAS, WORLD_W, WORLD_H, type ArenaId, type BrawlDifficulty } from '@/lib/gameRoomV2/bossBattle/brawl'
import { paintArena } from './scenery'
import { Bi, ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Boss Battle's start card: pick an arena (each shows a painted preview
// of the real arena) and a difficulty. Tamizhi card styling -- white,
// rounded-3xl, primary button, stone borders -- over the arena itself.

const DIFFICULTIES: { id: BrawlDifficulty; name: string; hint: string }[] = [
  { id: 'easy', name: 'Easy', hint: 'குறைவான, மென்மையான எதிரிகள்' },
  { id: 'normal', name: 'Normal', hint: 'சமமான போர்' },
  { id: 'hard', name: 'Hard', hint: 'கடுமையான படைகள்' },
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
              <h1 className="font-tamil text-2xl sm:text-3xl font-black text-stone-900 leading-tight">இருள் அரசனை வெல்வோம்</h1>
              <p className="text-sm font-semibold text-primary-700">Rise against the Irul King</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            <span className="font-tamil block text-stone-800">உங்கள் வீரரை நகர்த்துங்கள் -- ஆயுதங்கள் தானாகத் தாக்கும். நான்கு அலைகளைத் தாங்கி, தீப்பொறிகளைச் சேகரித்து நிலை உயர்ந்து, தலைமை எதிரிகளை வெல்லுங்கள். ஒவ்வொரு சாவடியிலும் தமிழ்ச் சவால்கள் உங்களைக் குணப்படுத்திப் பொன் மேம்பாடுகளைத் திறக்கும்.</span>
            Move your hero, and your weapons strike on their own. Survive four waves, collect sparks to level up, and defeat the bosses. Tamil challenges at each checkpoint heal you and unlock golden upgrades.
          </p>

          <h2 className="mt-4 text-sm font-bold text-stone-500"><span className="font-tamil">போர்க்களத்தைத் தேர்ந்தெடுங்கள்</span> <span className="text-xs">· Choose your arena</span></h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="போர்க்களம் · Arena">
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
                  <span className="block font-tamil text-sm font-extrabold text-stone-900 leading-tight">{a.tamilName}</span>
                  <span className="block text-[11px] text-stone-500 leading-tight">{a.name}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">{arena.blurb}</p>

          <h2 className="mt-4 text-sm font-bold text-stone-500"><Bi k="difficulty" inline /></h2>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={ta('difficulty', true)}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={difficulty === d.id}
                onClick={() => setDifficulty(d.id)}
                className={`min-h-[56px] rounded-2xl border-2 px-2 py-1.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${difficulty === d.id ? 'border-primary-600 bg-primary-50' : 'border-stone-200 hover:border-primary-300'}`}
              >
                <span className="block font-tamil font-extrabold text-stone-900">{TA[d.id].ta}</span>
                <span className="block text-[11px] font-bold text-stone-500">{d.name}</span>
                <span className="block font-tamil text-[11px] text-stone-500">{d.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
            <p className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2">
              <span className="font-bold text-stone-800"><span className="font-tamil">விசைப்பலகை</span> · Keyboard:</span> WASD or arrow keys to move · Space to dash · Esc to pause
            </p>
            <p className="rounded-2xl bg-stone-50 border border-stone-200 px-3 py-2">
              <span className="font-bold text-stone-800"><span className="font-tamil">தொடுதிரை</span> · Touch:</span> drag anywhere to move · tap the shield to dash
            </p>
          </div>

          <button
            type="button"
            onClick={() => onStart(difficulty)}
            className="mt-4 w-full min-h-[56px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white text-lg font-extrabold shadow-teal inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-400"
          >
            <FiShield className="w-5 h-5" aria-hidden /> <span className="font-tamil">களத்தில் இறங்கு</span> <span className="text-sm opacity-80">· Enter the arena</span>
          </button>
        </div>
      </div>
    </div>
  )
}
