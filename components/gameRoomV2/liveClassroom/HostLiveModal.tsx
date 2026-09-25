'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameV2Modal, GameV2Button, GameV2Loading, GameV2Empty } from '@/components/gameRoomV2'
import { RACING_DIFFICULTY_SETTINGS, type RacingDifficulty } from '@/lib/gameRoomV2/racing'
import { BOSSES, BOSS_BATTLE_DIFFICULTY_SETTINGS, type BossId, type BossBattleDifficulty } from '@/lib/gameRoomV2/bossBattle'
import { toast } from '@/lib/toast'

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
}

// The teacher flow's "Host Live" step: pick which class this live
// session is FOR (the enrollment-authorization anchor every joining
// student gets checked against), then create it and hand off to the
// host dashboard. A teacher with no classes sees an honest empty state
// rather than a picker with nothing in it.
export function HostLiveModal({
  open,
  onClose,
  questionSetId,
  engineId,
  setTitle,
}: {
  open: boolean
  onClose: () => void
  questionSetId: string
  engineId: string
  setTitle: string
}) {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [creating, setCreating] = useState(false)
  // Configurable question count (migration 081) -- empty string means
  // "use every question in the set", the pre-existing default. A plain
  // text state (not a number) so an empty field reads cleanly rather
  // than coercing to 0.
  const [questionCount, setQuestionCount] = useState('')
  // Shared race difficulty (migration 081) -- only meaningful/shown
  // when hosting Racing, since it's the one engine where every
  // participant must run identical physics for the race to be a fair
  // comparison.
  const [raceDifficulty, setRaceDifficulty] = useState<RacingDifficulty>('normal')
  // Shared boss + difficulty (migration 082) -- only meaningful/shown
  // when hosting Boss Battle, since the whole class cooperatively
  // fights ONE shared boss health pool.
  const [bossId, setBossId] = useState<BossId>(BOSSES[0].id)
  const [bossDifficulty, setBossDifficulty] = useState<BossBattleDifficulty>('normal')

  useEffect(() => {
    if (!open) return
    fetch('/api/gameroom-v2/live/classes')
      .then((res) => res.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => setClasses([]))
  }, [open])

  async function handleHost(classId: string) {
    setCreating(true)
    const res = await fetch('/api/gameroom-v2/live/host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionSetId,
        engineId,
        classId,
        questionCount: questionCount.trim() ? Number(questionCount) : null,
        raceDifficulty: engineId === 'racing' ? raceDifficulty : undefined,
        bossId: engineId === 'boss-battle' ? bossId : undefined,
        bossDifficulty: engineId === 'boss-battle' ? bossDifficulty : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      toast.error(data.error || 'Failed to host live session')
      return
    }
    router.push(`/gameroom-v2/live/host/${data.liveSessionId}`)
  }

  return (
    <GameV2Modal open={open} onClose={onClose} title="Host Live">
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Which class is &quot;{setTitle}&quot; for? Students in that class will be able to join with the code.
      </p>

      <label className="block mb-4">
        <span className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">Question count (optional)</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={questionCount}
          onChange={(e) => setQuestionCount(e.target.value)}
          placeholder="Use every question in the set"
          className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
        />
      </label>

      {engineId === 'racing' && (
        <label className="block mb-4">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">Race difficulty</span>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mb-1">Every racer shares this setting, so the race is a fair comparison.</p>
          <select
            value={raceDifficulty}
            onChange={(e) => setRaceDifficulty(e.target.value as RacingDifficulty)}
            className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
          >
            {RACING_DIFFICULTY_SETTINGS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {engineId === 'boss-battle' && (
        <>
          <label className="block mb-4">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">Boss</span>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 mb-1">The whole class cooperatively fights this one boss together.</p>
            <select
              value={bossId}
              onChange={(e) => setBossId(e.target.value as BossId)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
            >
              {BOSSES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block mb-4">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">Difficulty</span>
            <select
              value={bossDifficulty}
              onChange={(e) => setBossDifficulty(e.target.value as BossBattleDifficulty)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
            >
              {BOSS_BATTLE_DIFFICULTY_SETTINGS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {classes === null ? (
        <GameV2Loading label="Loading your classes..." />
      ) : classes.length === 0 ? (
        <GameV2Empty title="No classes yet" description="You need at least one class before hosting a live session." />
      ) : (
        <div className="grid gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={creating}
              onClick={() => handleHost(c.id)}
              className="text-left rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-primary-400 p-4 transition-colors disabled:opacity-50"
            >
              <p className="font-bold text-stone-800 dark:text-stone-100">{c.name}</p>
              {c.grade_level && <p className="text-xs text-stone-400 dark:text-stone-500">{c.grade_level}</p>}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <div className="mt-4">
          <GameV2Button fullWidth disabled>
            Starting...
          </GameV2Button>
        </div>
      )}
    </GameV2Modal>
  )
}
