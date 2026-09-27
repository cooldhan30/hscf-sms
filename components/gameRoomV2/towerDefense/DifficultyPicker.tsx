'use client'

import { useState } from 'react'
import { FiShield } from 'react-icons/fi'
import { GiCastle } from 'react-icons/gi'
import { DIFFICULTY_SETTINGS, TOWER_TYPES, type TowerDefenseDifficulty } from '@/lib/gameRoomV2/towerDefense'
import { TowerPreview } from './ArtPreview'
import { ta } from '@/components/gameRoomV2/Bi'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// The opening overlay, drawn OVER the live battlefield (fort, gate and
// road already visible behind it). Tamizhi surface: white card, teal
// primary button, stone borders.
export function DifficultyPicker({ onStart }: { onStart: (d: TowerDefenseDifficulty) => void }) {
  const [choice, setChoice] = useState<TowerDefenseDifficulty>('normal')
  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-gradient-to-t from-stone-900/40 via-stone-900/10 to-transparent">
      <div className="w-full max-w-lg rounded-3xl bg-white/95 shadow-2xl border border-white p-4 sm:p-6 animate-gamev2-pop-in">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
            <GiCastle className="w-7 h-7" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Game Room · Tower Defense</p>
            <h1 className="font-tamil text-2xl sm:text-3xl font-black text-stone-900 leading-tight">கோட்டை காப்போம்</h1>
            <p className="text-sm font-bold text-primary-700">Guard the Fort</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-stone-600"><span className="font-tamil block text-stone-800">இருள் படை சாலையில் அணிவகுக்கிறது. கோபுரங்களைக் கட்டுங்கள், தமிழ்ச் சவால்களுக்கு விடையளித்து நாணயங்களும் சுவடிகளும் பெறுங்கள், கோட்டையைக் காத்திடுங்கள்.</span>The Irul army marches down the road. Build towers, answer Tamil challenges for coins and scrolls, and hold the fort.</p>
        <div className="mt-3 flex items-end justify-center gap-1 sm:gap-3" aria-hidden>
          {TOWER_TYPES.map((t) => (
            <TowerPreview key={t.id} type={t.id} level={2} size={58} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={ta('difficulty', true)}>
          {DIFFICULTY_SETTINGS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={choice === d.id}
              onClick={() => setChoice(d.id)}
              className={`rounded-2xl border-2 px-2 py-2.5 min-h-[56px] text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${
                choice === d.id ? 'border-primary-600 bg-primary-50' : 'border-stone-200 hover:border-primary-400'
              }`}
            >
              <span className="block font-extrabold text-stone-900 font-tamil">{TA[d.id].ta}</span>
              <span className="block text-[11px] font-bold text-stone-500">{d.label}</span>
              <span className="block text-[11px] text-stone-500 leading-tight"><span className="font-tamil">{d.id === 'easy' ? 'மென்மையான அலைகள்' : d.id === 'normal' ? 'சமமான போர்' : 'கடுமையான படைகள்'}</span></span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onStart(choice)}
          className="mt-4 w-full min-h-[52px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-lg shadow-teal inline-flex items-center justify-center gap-2"
        >
          <FiShield className="w-5 h-5" aria-hidden /> <span className="font-tamil">தற்காப்பைத் தொடங்கு</span> <span className="text-sm opacity-80">· Start</span>
        </button>
      </div>
    </div>
  )
}
