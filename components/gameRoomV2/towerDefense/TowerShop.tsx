'use client'

import { FiArrowUp, FiDollarSign, FiX, FiCrosshair } from 'react-icons/fi'
import {
  TOWER_TYPES,
  getTowerType,
  statsFor,
  upgradeCost,
  sellValue,
  dps,
  MAX_TOWER_LEVEL,
  type Tower,
  type TowerTypeId,
  type TargetingMode,
} from '@/lib/gameRoomV2/towerDefense'

// Build menu (empty spot selected) or tower inspector (tower selected).
// Rendered beside/below the battlefield, never over it, so it never hides
// gameplay on a phone.

const TARGETING_LABEL: Record<TargetingMode, string> = { first: 'First', strongest: 'Strongest', closest: 'Closest' }

export function TowerIcon({ type, className = 'w-8 h-8' }: { type: TowerTypeId; className?: string }) {
  const color = getTowerType(type).color
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="17" r="13" fill="#57534e" />
      <circle cx="16" cy="16" r="12" fill="#e7e5e4" />
      {type === 'vel' && <path d="M8 14h12l6 2-6 2H8z" fill={color} />}
      {type === 'yanai' && (
        <>
          <circle cx="15" cy="16" r="6" fill={color} />
          <rect x="15" y="13" width="11" height="6" fill={color} />
        </>
      )}
      {type === 'pani' && (
        <>
          <circle cx="16" cy="16" r="7" fill={color} />
          <circle cx="16" cy="15" r="3.5" fill="#bae6fd" />
        </>
      )}
      {type === 'kuri' && (
        <>
          <path d="M13 7a10 10 0 0 1 0 18" stroke={color} strokeWidth="3" fill="none" />
          <path d="M11 16h15" stroke="#1c1917" strokeWidth="1.5" />
        </>
      )}
    </svg>
  )
}

function Stat({ label, value, next }: { label: string; value: string | number; next?: string | number }) {
  return (
    <div className="rounded-lg bg-stone-900/60 px-2 py-1.5">
      <p className="text-[11px] uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">
        {value}
        {next !== undefined && next !== value && <span className="text-emerald-300"> → {next}</span>}
      </p>
    </div>
  )
}

export function TowerShop({
  coins,
  selectedPadId,
  tower,
  onBuild,
  onUpgrade,
  onSell,
  onTargeting,
  onClose,
}: {
  coins: number
  selectedPadId: string | null
  tower: Tower | null
  onBuild: (type: TowerTypeId) => void
  onUpgrade: () => void
  onSell: () => void
  onTargeting: (mode: TargetingMode) => void
  onClose: () => void
}) {
  if (!selectedPadId) {
    return (
      <div className="rounded-2xl bg-stone-900/70 border border-white/10 p-4 text-sm text-stone-300">
        <p className="font-semibold text-white">Build your defence</p>
        <p className="mt-1">Tap a stone build spot on the field to place a tower, or tap a tower to upgrade it.</p>
      </div>
    )
  }

  if (!tower) {
    return (
      <div className="rounded-2xl bg-stone-900/80 border border-white/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-white">Build a tower</p>
          <button type="button" onClick={onClose} aria-label="Close build menu" className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-stone-300 hover:bg-white/10">
            <FiX className="w-4 h-4 mx-auto" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOWER_TYPES.map((t) => {
            const s = statsFor(t.id, 1)
            const affordable = coins >= t.cost
            return (
              <button
                key={t.id}
                type="button"
                disabled={!affordable}
                onClick={() => onBuild(t.id)}
                className="text-left rounded-xl border border-white/10 bg-stone-800/80 hover:bg-stone-700/80 p-2.5 min-h-[44px] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TowerIcon type={t.id} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight">{t.name}</p>
                    <p className="text-[11px] text-stone-400">{t.role}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-300 leading-snug line-clamp-2">{t.description}</p>
                <p className="mt-1.5 flex items-center justify-between text-xs">
                  <span className={`font-bold ${affordable ? 'text-yellow-300' : 'text-red-300'}`}>{t.cost} coins</span>
                  <span className="text-stone-400">
                    {t.id === 'pani' ? `slow ${Math.round((1 - s.slowFactor) * 100)}%` : `${dps(s)} dmg/s`}
                  </span>
                </p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const def = getTowerType(tower.type)
  const s = statsFor(tower.type, tower.level)
  const nextCost = upgradeCost(tower.type, tower.level)
  const n = nextCost !== null ? statsFor(tower.type, tower.level + 1) : null
  return (
    <div className="rounded-2xl bg-stone-900/80 border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TowerIcon type={tower.type} className="w-9 h-9" />
          <div className="min-w-0">
            <p className="font-semibold text-white leading-tight">
              {def.name} <span className="text-yellow-300">Lv {tower.level}</span>
            </p>
            <p className="font-tamil leading-relaxed text-xs text-stone-400">{def.tamilName}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close tower details" className="p-2 min-w-[40px] min-h-[40px] rounded-lg text-stone-300 hover:bg-white/10">
          <FiX className="w-4 h-4 mx-auto" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        <Stat label="Damage" value={s.damage} next={n?.damage} />
        <Stat label="Range" value={s.range.toFixed(1)} next={n?.range.toFixed(1)} />
        <Stat label="Speed" value={`${(1000 / s.fireIntervalMs).toFixed(1)}/s`} next={n ? `${(1000 / n.fireIntervalMs).toFixed(1)}/s` : undefined} />
        {tower.type === 'pani' && <Stat label="Slow" value={`${Math.round((1 - s.slowFactor) * 100)}%`} next={n ? `${Math.round((1 - n.slowFactor) * 100)}%` : undefined} />}
        {tower.type === 'yanai' && <Stat label="Blast" value={s.splashRadius.toFixed(1)} next={n?.splashRadius.toFixed(1)} />}
        <Stat label="Defeated" value={tower.kills} />
        <Stat label="Dealt" value={Math.round(tower.damageDealt)} />
      </div>
      {tower.type !== 'pani' && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-stone-400 mb-1 flex items-center gap-1">
            <FiCrosshair className="w-3 h-3" aria-hidden /> Target
          </p>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Targeting">
            {(Object.keys(TARGETING_LABEL) as TargetingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={tower.targeting === mode}
                onClick={() => onTargeting(mode)}
                className={`min-h-[40px] rounded-lg text-xs font-semibold ${tower.targeting === mode ? 'bg-yellow-400 text-stone-900' : 'bg-stone-800 text-stone-200 hover:bg-stone-700'}`}
              >
                {TARGETING_LABEL[mode]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          disabled={nextCost === null || coins < nextCost}
          onClick={onUpgrade}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <FiArrowUp className="w-4 h-4" aria-hidden />
          {nextCost === null ? `Max (Lv ${MAX_TOWER_LEVEL})` : `Upgrade ${nextCost}`}
        </button>
        <button
          type="button"
          onClick={onSell}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-stone-700 hover:bg-stone-600 text-white text-sm font-bold"
        >
          <FiDollarSign className="w-4 h-4" aria-hidden /> Sell {sellValue(tower)}
        </button>
      </div>
    </div>
  )
}
