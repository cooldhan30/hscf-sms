import type { GameEngine } from './engine'
import type { GameRoomQuestionType } from './questionTypes'

export interface EngineCompatibilityResult {
  engine: GameEngine
  compatible: boolean
  // Populated only when compatible === false -- the exact question
  // types in the set this engine has no support for, so the UI can
  // explain *why* rather than just showing a ✗ (per the spec's
  // "Explain incompatibility when necessary").
  unsupportedTypes: GameRoomQuestionType[]
}

// The concrete "PLAYABLE GAMES" calculation run after a set is saved.
// A set is compatible with an engine only if EVERY question type
// actually present in the set is one the engine declares support for --
// computed fresh from the two independent declarations (the set's
// question types, the engine's compatibility.supportedQuestionTypes),
// never a hardcoded per-pair mapping. This is the same rule
// registry.ts's compatibleEnginesForQuestionTypes() already applies;
// this version additionally reports WHY an incompatible engine failed,
// for display in the builder's results.
export function checkEngineCompatibility(
  engines: GameEngine[],
  questionTypes: GameRoomQuestionType[]
): EngineCompatibilityResult[] {
  return engines.map((engine) => {
    const unsupportedTypes = questionTypes.filter((t) => !engine.compatibility.supportedQuestionTypes.includes(t))
    return {
      engine,
      compatible: unsupportedTypes.length === 0,
      unsupportedTypes,
    }
  })
}
