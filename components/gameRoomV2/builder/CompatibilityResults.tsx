import { FiCheck, FiX } from 'react-icons/fi'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { gamePickerForSet } from '@/lib/gameRoomV2/gameAvailability'
import { GameV2Card } from '@/components/gameRoomV2'

// "PLAYABLE GAMES" -- computed fresh every render from the set's actual
// question types against the V2 engine registry's declared
// compatibility via gamePickerForSet (the shared availability rule),
// never a stored/cached list -- so this always reflects the CURRENT
// question mix, including while a teacher is still editing before
// saving. Lists every ACTIVE game; Coming Soon games are named
// separately and never counted as playable.
export function CompatibilityResults({ questionTypes }: { questionTypes: GameRoomQuestionType[] }) {
  const picker = gamePickerForSet(questionTypes)
  const results = picker.active.map((a) => ({ engine: a.engine, compatible: a.playable, reason: a.reason }))
  const compatibleCount = picker.playable.length

  return (
    <GameV2Card>
      <p className="font-bold text-stone-800 dark:text-stone-100 mb-1">Playable Games</p>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        {compatibleCount} of {results.length} games can play this set, based on its question types.
      </p>
      <div className="space-y-2">
        {results.map(({ engine, compatible, reason }) => (
          <div
            key={engine.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${
              compatible ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-stone-50 dark:bg-stone-900/40'
            }`}
          >
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                // gamev2ink-950, not white -- white-on-mint-500 fails
                // even the 3:1 WCAG minimum for a meaningful UI icon.
                compatible ? 'bg-emerald-500 text-primary-900' : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
              }`}
            >
              {compatible ? <FiCheck className="w-3.5 h-3.5" /> : <FiX className="w-3.5 h-3.5" />}
            </span>
            <div>
              <p className={`font-bold ${compatible ? 'text-emerald-800 dark:text-emerald-300' : 'text-stone-600 dark:text-stone-300'}`}>
                {engine.name}
                {compatible && (
                  <span className="ml-2 font-normal text-xs text-stone-400 dark:text-stone-500">~{engine.estimatedDurationMinutes} min</span>
                )}
              </p>
              {!compatible && reason && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{reason.en}</p>}
            </div>
          </div>
        ))}
      </div>
      {picker.comingSoon.length > 0 && (
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">Coming soon (not playable yet): {picker.comingSoon.map((e) => e.name).join(', ')}</p>
      )}
    </GameV2Card>
  )
}
