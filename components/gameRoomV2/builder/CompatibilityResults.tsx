import { FiCheck, FiX } from 'react-icons/fi'
import { checkEngineCompatibility, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'
import { GameV2Card } from '@/components/gameRoomV2'

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True/False',
  IMAGE_CHOICE: 'Image Choice',
  TEXT_INPUT: 'Text Input',
  FILL_BLANK: 'Fill in the Blank',
  MATCH: 'Match',
  ORDER_LETTERS: 'Order Letters',
  ORDER_WORDS: 'Order Words',
  CATEGORIZE: 'Categorize',
  AUDIO_CHOICE: 'Audio Choice',
}

// "PLAYABLE GAMES" -- computed fresh every render from the set's actual
// question types against the V2 engine registry's declared
// compatibility (checkEngineCompatibility), never a stored/cached
// list -- so this always reflects the CURRENT question mix, including
// while a teacher is still editing before saving.
export function CompatibilityResults({ questionTypes }: { questionTypes: GameRoomQuestionType[] }) {
  const results = checkEngineCompatibility(GAME_ENGINES_V2, questionTypes)
  const compatibleCount = results.filter((r) => r.compatible).length

  return (
    <GameV2Card>
      <p className="font-bold text-stone-800 dark:text-stone-100 mb-1">Playable Games</p>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        {compatibleCount} of {results.length} games can play this set, based on its question types.
      </p>
      <div className="space-y-2">
        {results.map(({ engine, compatible, unsupportedTypes }) => (
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
              {!compatible && unsupportedTypes.length > 0 && (
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  Doesn&apos;t support: {unsupportedTypes.map((t) => TYPE_LABEL[t] ?? t).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </GameV2Card>
  )
}
