import type { GameModule } from './gameModule'
import { tamilGrammarModule } from './modules/tamilGrammar'

// The platform's single extension point -- a future second game
// registers itself here and immediately appears in the host's game-type
// dropdown (GET /api/game-room/games) with zero changes to the session/
// scoring/leaderboard/student-play engine, which only ever deals in
// GameModule/GameQuestion shapes.
export const GAME_MODULES: GameModule[] = [tamilGrammarModule]

export function getGameModule(id: string): GameModule | undefined {
  return GAME_MODULES.find((m) => m.id === id)
}
