import type { GameEngine, GameEngineRequirement, GameRoomQuestionType } from './domain'
import { checkEngineCompatibility } from './domain/compatibility'
import { GAME_ENGINES_V2, getGameEngineV2 } from './registry'

// The ONE place that decides how a GameRoom game surfaces anywhere:
// whether it exists on screen at all, whether it can be launched, and
// whether it can play a particular question set. Pure and client-safe
// (no server-only imports) so the same answer is computed in pickers,
// server routes and verifier scripts alike.
//
//   ACTIVE/BETA + compatible set   -> PLAYABLE
//   ACTIVE/BETA + incompatible set -> INCOMPATIBLE: still shown, disabled,
//                                     with a one-line reason
//   ACTIVE/BETA, no Live support   -> MODE_UNSUPPORTED (live pickers only)
//   COMING_SOON/ALPHA              -> never launchable; only ever listed in a
//                                     separate "Coming Soon" section after
//                                     every active game
//   HIDDEN/DISABLED                -> on no surface at all
//
// Every surface must go through these helpers -- no screen filters
// GAME_ENGINES_V2 or compares engine.status itself
// (scripts/verify-gameroom-v2-game-registry.ts enforces that).

export type GameMode = 'solo' | 'live'

export type GameAvailabilityState = 'PLAYABLE' | 'INCOMPATIBLE' | 'MODE_UNSUPPORTED' | 'COMING_SOON'

export interface GameAvailability {
  engine: GameEngine
  state: GameAvailabilityState
  playable: boolean
  // Concise, human-facing reason when not playable; null when playable.
  reason: GameEngineRequirement | null
  unsupportedTypes: GameRoomQuestionType[]
}

const LIVE_UNSUPPORTED: GameEngineRequirement = {
  en: 'Solo play only -- not available in Live Classroom yet',
  ta: 'தனி விளையாட்டு மட்டும்',
}
const COMING_SOON_REASON: GameEngineRequirement = { en: 'Coming soon -- not playable yet', ta: 'விரைவில் வருகிறது' }
const EMPTY_SET_REASON: GameEngineRequirement = { en: 'Add questions to this set first', ta: 'முதலில் வினாக்களைச் சேர்க்கவும்' }

// Can students/teachers start this game at all?
export function isEngineLaunchable(engine: GameEngine): boolean {
  return engine.status === 'ACTIVE' || engine.status === 'BETA'
}

// Is this game shown as "Coming Soon" (listed, never launchable)?
export function isEngineComingSoon(engine: GameEngine): boolean {
  return engine.status === 'COMING_SOON' || engine.status === 'ALPHA'
}

// Does this game appear on any GameRoom surface at all?
export function isEngineListed(engine: GameEngine): boolean {
  return isEngineLaunchable(engine) || isEngineComingSoon(engine)
}

export function supportsMode(engine: GameEngine, mode: GameMode): boolean {
  return mode === 'live' ? engine.compatibility.liveClassroomSupport : engine.compatibility.soloSupport
}

// Every launchable game, in registry (display) order. With a mode, only
// the ones that support it.
export function launchableEngines(mode?: GameMode): GameEngine[] {
  return GAME_ENGINES_V2.filter((e) => isEngineLaunchable(e) && (!mode || supportsMode(e, mode)))
}

export function comingSoonEngines(): GameEngine[] {
  return GAME_ENGINES_V2.filter(isEngineComingSoon)
}

// Every game that appears anywhere (launchable, then coming soon).
export function listedEngines(): GameEngine[] {
  return GAME_ENGINES_V2.filter(isEngineListed)
}

// The full verdict for one game against one set's question types.
export function gameAvailability(
  engine: GameEngine,
  questionTypes: readonly GameRoomQuestionType[],
  mode?: GameMode
): GameAvailability {
  if (!isEngineLaunchable(engine)) {
    return { engine, state: 'COMING_SOON', playable: false, reason: COMING_SOON_REASON, unsupportedTypes: [] }
  }
  if (questionTypes.length === 0) {
    return { engine, state: 'INCOMPATIBLE', playable: false, reason: EMPTY_SET_REASON, unsupportedTypes: [] }
  }
  const { unsupportedTypes } = checkEngineCompatibility([engine], [...questionTypes])[0]
  if (unsupportedTypes.length > 0) {
    return {
      engine,
      state: 'INCOMPATIBLE',
      playable: false,
      reason: engine.requirement ?? {
        en: `Doesn't support: ${unsupportedTypes.map(questionTypeLabel).join(', ')}`,
        ta: 'இந்த வினா வகைகள் பொருந்தவில்லை',
      },
      unsupportedTypes,
    }
  }
  if (mode && !supportsMode(engine, mode)) {
    return { engine, state: 'MODE_UNSUPPORTED', playable: false, reason: LIVE_UNSUPPORTED, unsupportedTypes: [] }
  }
  return { engine, state: 'PLAYABLE', playable: true, reason: null, unsupportedTypes: [] }
}

export interface GamePicker {
  // Every launchable game: playable ones first, then disabled-with-reason
  // ones, each group in registry order. An ACTIVE game is NEVER dropped
  // here -- if it can't play the set, it is shown disabled and says why.
  active: GameAvailability[]
  playable: GameAvailability[]
  // Separate, always-last section. Never launchable.
  comingSoon: GameEngine[]
}

// What "Choose a Game" (and every other per-set picker) shows for a set.
export function gamePickerForSet(questionTypes: readonly GameRoomQuestionType[], mode?: GameMode): GamePicker {
  const all = launchableEngines().map((e) => gameAvailability(e, questionTypes, mode))
  const playable = all.filter((a) => a.playable)
  return { active: [...playable, ...all.filter((a) => !a.playable)], playable, comingSoon: comingSoonEngines() }
}

export function playableEnginesForSet(questionTypes: readonly GameRoomQuestionType[], mode?: GameMode): GameEngine[] {
  return gamePickerForSet(questionTypes, mode).playable.map((a) => a.engine)
}

export type LaunchCheck =
  | { ok: true; engine: GameEngine }
  | { ok: false; status: 400 | 409; error: string; engine?: GameEngine }

// Server-side launch guard shared by sessions/start and live/host: the
// exact same rule the pickers display, so a game shown as playable can
// always be started and one shown disabled can never be.
export function checkGameLaunch(engineId: string, questionTypes: readonly GameRoomQuestionType[], mode: GameMode): LaunchCheck {
  const engine = getGameEngineV2(engineId)
  if (!engine || !isEngineListed(engine)) return { ok: false, status: 400, error: 'Unknown game engine' }
  const a = gameAvailability(engine, questionTypes, mode)
  if (a.playable) return { ok: true, engine }
  if (a.state === 'COMING_SOON') return { ok: false, status: 409, error: `${engine.name} is not playable yet (${engine.status})`, engine }
  return { ok: false, status: 409, error: `${engine.name}: ${a.reason?.en ?? 'not available for this set'}`, engine }
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True/False',
  IMAGE_CHOICE: 'Image Choice',
  TEXT_INPUT: 'Short Answer',
  FILL_BLANK: 'Fill in the Blank',
  MATCH: 'Match',
  ORDER_LETTERS: 'Order Letters',
  ORDER_WORDS: 'Order Words',
  CATEGORIZE: 'Categorize',
  AUDIO_CHOICE: 'Audio Choice',
  PRONUNCIATION: 'Pronunciation',
  READING_FLUENCY: 'Reading Fluency',
}

export function questionTypeLabel(t: string): string {
  return QUESTION_TYPE_LABELS[t] ?? t
}
