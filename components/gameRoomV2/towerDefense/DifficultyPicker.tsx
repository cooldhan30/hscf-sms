'use client'

import { useState } from 'react'
import { FiBookOpen, FiDollarSign, FiShield, FiPlay } from 'react-icons/fi'
import { DIFFICULTY_SETTINGS, TOWER_TYPES, type TowerDefenseDifficulty } from '@/lib/gameRoomV2/towerDefense'
import { TowerIcon } from './TowerShop'

// Tower Defense setup: how the game works and a difficulty choice.
// Difficulty changes enemies and coins only -- never the Tamil content.
export function DifficultyPicker({ onStart }: { onStart: (d: TowerDefenseDifficulty) => void }) {
  const [choice, setChoice] = useState<TowerDefenseDifficulty>('normal')
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      <div className="rounded-3xl bg-gradient-to-b from-stone-800 to-stone-900 border border-white/10 p-5 sm:p-7 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300">Tower Defense</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Guard the Fort</h1>
        <p className="font-tamil leading-relaxed text-lg text-stone-300">கோட்டையைக் காப்போம்</p>

        <ol className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <li className="rounded-2xl bg-white/5 p-3">
            <FiBookOpen className="w-5 h-5 text-yellow-300" aria-hidden />
            <p className="font-semibold mt-1.5">1. Answer</p>
            <p className="text-stone-300">Before each wave, answer Tamil challenges. Correct answers earn coins and scrolls.</p>
          </li>
          <li className="rounded-2xl bg-white/5 p-3">
            <FiDollarSign className="w-5 h-5 text-yellow-300" aria-hidden />
            <p className="font-semibold mt-1.5">2. Build</p>
            <p className="text-stone-300">Spend coins on towers and upgrades. Scrolls power special abilities.</p>
          </li>
          <li className="rounded-2xl bg-white/5 p-3">
            <FiShield className="w-5 h-5 text-yellow-300" aria-hidden />
            <p className="font-semibold mt-1.5">3. Defend</p>
            <p className="text-stone-300">Stop every wave before it reaches your fort. The last wave brings the Irul King.</p>
          </li>
        </ol>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TOWER_TYPES.map((t) => (
            <div key={t.id} className="rounded-xl bg-white/5 p-2 flex items-center gap-2">
              <TowerIcon type={t.id} />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{t.name}</p>
                <p className="text-[11px] text-stone-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold mb-2">Difficulty</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DIFFICULTY_SETTINGS.map((d) => (
              <label
                key={d.id}
                className={`cursor-pointer rounded-2xl border p-3 min-h-[44px] transition-colors ${
                  choice === d.id ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <input type="radio" name="td-difficulty" value={d.id} checked={choice === d.id} onChange={() => setChoice(d.id)} className="sr-only" />
                <p className="font-semibold">{d.label}</p>
                <p className="text-xs text-stone-300 mt-0.5">{d.description}</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  {d.startingCoins} coins · fort {d.baseHealth}
                </p>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => onStart(choice)}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-stone-900 text-lg font-bold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
        >
          <FiPlay className="w-5 h-5" aria-hidden /> Start the defence
        </button>
      </div>
    </div>
  )
}
