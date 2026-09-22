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
      <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 mb-1">Playable Games</p>
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mb-4">
        {compatibleCount} of {results.length} games can play this set, based on its question types.
      </p>
      <div className="space-y-2">
        {results.map(({ engine, compatible, unsupportedTypes }) => (
          <div
            key={engine.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${
              compatible ? 'bg-gamev2mint-50 dark:bg-gamev2mint-500/10' : 'bg-gamev2ink-50 dark:bg-gamev2ink-900/40'
            }`}
          >
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                compatible ? 'bg-gamev2mint-500 text-white' : 'bg-gamev2ink-200 dark:bg-gamev2ink-700 text-gamev2ink-500 dark:text-gamev2ink-400'
              }`}
            >
              {compatible ? <FiCheck className="w-3.5 h-3.5" /> : <FiX className="w-3.5 h-3.5" />}
            </span>
            <div>
              <p className={`font-bold ${compatible ? 'text-gamev2mint-800 dark:text-gamev2mint-300' : 'text-gamev2ink-600 dark:text-gamev2ink-300'}`}>
                {engine.name}
              </p>
              {!compatible && unsupportedTypes.length > 0 && (
                <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mt-0.5">
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
