'use client'

import { useState } from 'react'
import { GameV2Card } from '@/components/gameRoomV2'
import { BOSSES, BOSS_BATTLE_DIFFICULTY_SETTINGS, type BossId, type BossBattleDifficulty } from '@/lib/gameRoomV2/bossBattle'

const BOSS_EMOJI: Record<BossId, string> = { suran: '\u{1F479}', 'kotravai-guardian': '\u{1F9DE}', 'naga-serpent': '\u{1F40D}' }

// The pre-battle setup screen: pick a boss (each with its own phase
// count/pacing) and a difficulty (gameplay parameters only -- question
// difficulty always comes from the session's Question Set).
export function BossSetupPicker({ onStart }: { onStart: (bossId: BossId, difficulty: BossBattleDifficulty) => void }) {
  const [bossId, setBossId] = useState<BossId>(BOSSES[0].id)

  return (
    <GameV2Card padding="lg" className="max-w-xl w-full mx-auto text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'⚔️'}
      </div>
      <h2 className="text-2xl font-extrabold text-gamev2ink-900 dark:text-white">Boss Battle</h2>
      <p className="mt-2 text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
        Answer correctly to damage the boss and charge your abilities. Watch out -- the boss counterattacks, and gets fiercer each phase.
      </p>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose your boss
      </p>
      <div className="grid gap-2">
        {BOSSES.map((boss) => (
          <button
            key={boss.id}
            onClick={() => setBossId(boss.id)}
            className={`text-left flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 ${
              bossId === boss.id
                ? 'border-gamev2spark-500 bg-gamev2spark-50 dark:bg-gamev2spark-500/10'
                : 'border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2ink-300'
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {BOSS_EMOJI[boss.id]}
            </span>
            <div className="min-w-0">
              <p className="font-extrabold text-sm text-gamev2ink-900 dark:text-white truncate">
                {boss.name} <span className="font-tamil leading-relaxed text-gamev2ink-400 dark:text-gamev2ink-500">· {boss.tamilName}</span>
              </p>
              <p className="text-xs text-gamev2ink-500 dark:text-gamev2ink-400">{boss.description}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-2 text-left">
        Choose difficulty
      </p>
      <div className="grid gap-3">
        {BOSS_BATTLE_DIFFICULTY_SETTINGS.map((d) => (
          <button
            key={d.id}
            onClick={() => onStart(bossId, d.id)}
            className="text-left rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2spark-400 dark:hover:border-gamev2spark-500 bg-gamev2ink-50 dark:bg-gamev2ink-800/50 p-4 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
          >
            <p className="font-extrabold text-gamev2ink-900 dark:text-white">{d.label}</p>
            <p className="text-xs text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{d.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-gamev2ink-400 dark:text-gamev2ink-500">
        Question difficulty always comes from your teacher&apos;s Question Set, not from this setting.
      </p>
    </GameV2Card>
  )
}
