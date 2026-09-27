'use client'

import { FiX, FiTarget, FiZap, FiCrosshair, FiTrendingUp, FiDollarSign } from 'react-icons/fi'
import { GiTwoCoins } from 'react-icons/gi'
import {
  TOWER_TYPES,
  getTowerType,
  statsFor,
  upgradeCost,
  sellValue,
  MAX_TOWER_LEVEL,
  type Tower,
  type TowerTypeId,
  type TargetingMode,
} from '@/lib/gameRoomV2/towerDefense'
import { TowerPreview } from './ArtPreview'
import { TA } from '@/lib/gameRoomV2/i18n/ta'

// Contextual tower UI: a build menu that opens next to an empty build
// spot, and an inspector that opens next to a tower. Neither is ever a
// permanent panel; on a phone they dock as a bottom sheet. Tamizhi
// surface: white card, stone borders, teal primary, rounded-2xl.

export const TOWER_HINT: Record<TowerTypeId, string> = {
  vel: 'வேகமான ஈட்டிகள்',
  yanai: 'கூட்டத்தைத் தாக்கும்',
  pani: 'எதிரிகளை மெதுவாக்கும்',
  kuri: 'கவசத்தைத் துளைக்கும்',
}

export interface Anchor {
  x: number
  y: number
  viewW: number
  viewH: number
  cell: number
}

function place(a: Anchor, w: number, h: number): React.CSSProperties {
  if (a.viewW < 640) return { left: 8, right: 8, bottom: 96 }
  const above = a.y > a.viewH * 0.52
  const left = Math.min(a.viewW - w - 10, Math.max(10, a.x - w / 2))
  const top = above ? Math.max(70, a.y - h - a.cell * 0.75) : Math.min(a.viewH - h - 100, a.y + a.cell * 0.6)
  return { left, top, width: w }
}

export function BuildMenu({ anchor, coins, onBuild, onClose }: { anchor: Anchor; coins: number; onBuild: (t: TowerTypeId) => void; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="கோபுரம் கட்டு · Build a tower"
      className="absolute z-30 rounded-3xl bg-white shadow-2xl border border-stone-200 p-3 animate-gamev2-pop-in"
      style={place(anchor, 460, 190)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-extrabold text-stone-800"><span className="font-tamil">கோபுரம் கட்டு</span> <span className="text-xs font-semibold text-stone-500">· Build a tower</span></p>
        <button type="button" onClick={onClose} aria-label="மூடு · Close" className="w-9 h-9 rounded-xl text-stone-500 hover:bg-stone-100 flex items-center justify-center">
          <FiX className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {TOWER_TYPES.map((t) => {
          const afford = coins >= t.cost
          return (
            <button
              key={t.id}
              type="button"
              disabled={!afford}
              onClick={() => onBuild(t.id)}
              aria-label={`${t.tamilName} (${t.name}), ${TOWER_HINT[t.id]}, ${t.cost} ${TA.coins.ta}`}
              className="group flex flex-col items-center rounded-2xl border-2 border-stone-200 hover:border-primary-500 hover:bg-primary-50 px-1 pt-1 pb-2 min-h-[44px] transition-colors disabled:opacity-45 disabled:hover:border-stone-200 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
            >
              <span className="transition-transform group-hover:scale-110 group-active:scale-95">
                <TowerPreview type={t.id} size={anchor.viewW < 640 ? 48 : 60} />
              </span>
              <span className="font-tamil text-[12px] font-extrabold text-stone-800 leading-tight text-center">{t.tamilName}</span>
              <span className="font-tamil text-[10px] font-semibold text-primary-700 leading-tight text-center">{TOWER_HINT[t.id]}</span>
              <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${afford ? 'bg-gold-100 text-gold-800' : 'bg-stone-100 text-stone-500'}`}>
                <GiTwoCoins className="w-3 h-3" aria-hidden />
                {t.cost}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const TARGETS: { id: TargetingMode; label: string }[] = [
  { id: 'first', label: 'முதல்' },
  { id: 'strongest', label: 'வலியது' },
  { id: 'closest', label: 'அருகில்' },
]

export function TowerInspector({
  anchor,
  tower,
  coins,
  onUpgrade,
  onSell,
  onTargeting,
  onClose,
}: {
  anchor: Anchor
  tower: Tower
  coins: number
  onUpgrade: () => void
  onSell: () => void
  onTargeting: (m: TargetingMode) => void
  onClose: () => void
}) {
  const def = getTowerType(tower.type)
  const st = statsFor(tower.type, tower.level)
  const next = tower.level < MAX_TOWER_LEVEL ? statsFor(tower.type, tower.level + 1) : null
  const cost = upgradeCost(tower.type, tower.level)
  const special = tower.type === 'pani' ? `வேகம் ${Math.round(st.slowFactor * 100)}% ஆகக் குறையும்` : tower.type === 'yanai' ? `பரவல் ${st.splashRadius.toFixed(1)} கட்டம்` : tower.type === 'kuri' ? 'கவசத்தைப் பொருட்படுத்தாது' : 'விரைவுத் தாக்குதல்'
  const stat = (icon: React.ReactNode, label: string, v: string, up?: string) => (
    <div className="flex items-center gap-1.5 rounded-xl bg-stone-50 px-2 py-1.5">
      <span className="text-primary-700" aria-hidden>
        {icon}
      </span>
      <span className="font-tamil text-[11px] text-stone-500">{label}</span>
      <span className="ml-auto text-xs font-extrabold text-stone-800 tabular-nums">
        {v}
        {up && <span className="text-emerald-600"> → {up}</span>}
      </span>
    </div>
  )
  return (
    <div
      role="dialog"
      aria-label={`${def.tamilName} · ${def.name}`}
      className="absolute z-30 rounded-3xl bg-white shadow-2xl border border-stone-200 p-3 animate-gamev2-pop-in"
      style={place(anchor, 340, 250)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <TowerPreview type={tower.type} level={tower.level} size={64} animate />
        <div className="flex-1 min-w-0">
          <p className="font-tamil font-extrabold text-stone-900 leading-tight">{def.tamilName}</p>
          <p className="text-xs text-primary-700">{def.name}</p>
          <p className="text-[11px] font-bold text-gold-700 mt-0.5">
            <span className="font-tamil">{TA.level.ta} {tower.level}/{MAX_TOWER_LEVEL} · {tower.kills} வீழ்த்தியது</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="மூடு · Close" className="w-9 h-9 rounded-xl text-stone-500 hover:bg-stone-100 flex items-center justify-center">
          <FiX className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {stat(<FiZap className="w-3.5 h-3.5" />, 'தாக்கு வலிமை', String(st.damage), next ? String(next.damage) : undefined)}
        {stat(<FiTarget className="w-3.5 h-3.5" />, 'எல்லை', st.range.toFixed(1), next ? next.range.toFixed(1) : undefined)}
        {stat(<FiTrendingUp className="w-3.5 h-3.5" />, 'வேகம்', `${(1000 / st.fireIntervalMs).toFixed(1)}/s`, next ? `${(1000 / next.fireIntervalMs).toFixed(1)}/s` : undefined)}
        <div className="font-tamil flex items-center rounded-xl bg-primary-50 px-2 py-1.5 text-[11px] font-bold text-primary-800">{special}</div>
      </div>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="இலக்கு · Targeting">
        <FiCrosshair className="w-3.5 h-3.5 text-stone-500 mr-0.5" aria-hidden />
        {TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tower.targeting === t.id}
            onClick={() => onTargeting(t.id)}
            className={`flex-1 min-h-[36px] rounded-xl text-xs font-bold border ${tower.targeting === t.id ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
          >
            <span className="font-tamil">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={cost === null || coins < cost}
          onClick={onUpgrade}
          className="min-h-[44px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white font-extrabold text-sm disabled:opacity-45 inline-flex items-center justify-center gap-1"
        >
          <span className="font-tamil">{cost === null ? 'உச்ச நிலை' : `மேம்படுத்து ${cost}`}</span>
          {cost !== null && <GiTwoCoins className="w-4 h-4" aria-hidden />}
        </button>
        <button type="button" onClick={onSell} className="min-h-[44px] rounded-2xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-bold text-sm inline-flex items-center justify-center gap-1">
          <FiDollarSign className="w-4 h-4" aria-hidden />
          <span className="font-tamil">விற்பனை</span> {sellValue(tower)}
        </button>
      </div>
    </div>
  )
}
