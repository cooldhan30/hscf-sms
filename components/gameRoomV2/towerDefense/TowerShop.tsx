'use client'

import { GameV2Button } from '@/components/gameRoomV2'
import { TOWER_TYPES, getTowerType, type BattlefieldState, type TowerTypeId } from '@/lib/gameRoomV2/towerDefense'

const TOWER_EMOJI: Record<TowerTypeId, string> = { vel: '\u{1F531}', yanai: '\u{1F418}', pani: '❄️' }

// The shop panel: pick a tower type, then tap an empty pad on the
// battlefield to place it -- or tap an occupied pad to see its upgrade
// option. Coins here are the in-game, session-local currency spent on
// towers (reset every playthrough), distinct from the account's real
// persisted XP/coins ledger, which the shared session framework already
// manages untouched.
export function TowerShop({
  state,
  selectedTowerType,
  onSelectTowerType,
  selectedPadId,
  onUpgrade,
  onClearSelection,
}: {
  state: BattlefieldState
  selectedTowerType: TowerTypeId
  onSelectTowerType: (id: TowerTypeId) => void
  selectedPadId: string | null
  onUpgrade: () => void
  onClearSelection: () => void
}) {
  const towerOnPad = selectedPadId ? state.towers.find((t) => t.padId === selectedPadId) : undefined

  if (selectedPadId && towerOnPad) {
    const type = getTowerType(towerOnPad.typeId)
    const upgradeCost = Math.round(type.upgradeCost * Math.pow(1.5, towerOnPad.level - 1))
    return (
      <div className="rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 p-4 flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {TOWER_EMOJI[type.id]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm text-gamev2ink-900 dark:text-white truncate">
            {type.name} · Lv{towerOnPad.level}
          </p>
          <p className="text-xs text-gamev2ink-500 dark:text-gamev2ink-400">Upgrade cost: {upgradeCost} coins</p>
        </div>
        <GameV2Button size="md" variant="spark" disabled={state.coins < upgradeCost} onClick={onUpgrade}>
          Upgrade
        </GameV2Button>
        <GameV2Button size="md" variant="ghost" onClick={onClearSelection}>
          Close
        </GameV2Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 bg-white dark:bg-gamev2ink-900 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2">
        {selectedPadId ? 'Tap Place to build here' : 'Choose a tower, then tap an empty pad'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TOWER_TYPES.map((type) => {
          const affordable = state.coins >= type.cost
          const active = selectedTowerType === type.id
          return (
            <button
              key={type.id}
              onClick={() => onSelectTowerType(type.id)}
              disabled={!affordable}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 disabled:opacity-40 ${
                active
                  ? 'border-gamev2spark-500 bg-gamev2spark-50 dark:bg-gamev2spark-500/10'
                  : 'border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2ink-300'
              }`}
              title={type.description}
            >
              <span className="text-xl" aria-hidden>
                {TOWER_EMOJI[type.id]}
              </span>
              <span className="text-[11px] font-bold text-gamev2ink-800 dark:text-gamev2ink-100 leading-tight text-center">
                {type.tamilName}
              </span>
              <span className="text-[10px] font-semibold text-gamev2spark-600 dark:text-gamev2spark-400">{type.cost}c</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
