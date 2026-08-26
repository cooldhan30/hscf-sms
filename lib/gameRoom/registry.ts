import type { GameModule } from './gameModule'
import type { InteractiveGameModule } from './interactiveModule'
import { tamilGrammarModule } from './modules/tamilGrammar'
import { uyirOrderModule, uyirMemoryModule } from './modules/uyirEzhuthukkal'
import { meiOrderModule, meiMemoryModule } from './modules/meiEzhuthukkal'
import { uyirKurilNedilSortModule, uyirKurilNedilMemoryModule } from './modules/uyirKurilNedil'
import { meiVallinamMellinamIdaiyinamSortModule } from './modules/meiVallinamMellinamIdaiyinam'
import { inaEzhuthukkalMatchingModule } from './modules/inaEzhuthukkal'

// The platform's single extension point -- a future second game
// registers itself here and immediately appears in the host's game-type
// dropdown (GET /api/game-room/games) with zero changes to the session/
// scoring/leaderboard/student-play engine, which only ever deals in
// GameModule/GameQuestion shapes.
export const GAME_MODULES: GameModule[] = [tamilGrammarModule]

export function getGameModule(id: string): GameModule | undefined {
  return GAME_MODULES.find((m) => m.id === id)
}

// A separate registry for the non-quiz "interactive" games (drag-order,
// memory-match) -- see lib/gameRoom/interactiveModule.ts for why these
// don't share GameModule's contract. Additive alongside GAME_MODULES;
// neither registry affects the other.
export const INTERACTIVE_GAME_MODULES: InteractiveGameModule[] = [
  uyirOrderModule,
  uyirMemoryModule,
  meiOrderModule,
  meiMemoryModule,
  uyirKurilNedilSortModule,
  uyirKurilNedilMemoryModule,
  meiVallinamMellinamIdaiyinamSortModule,
  inaEzhuthukkalMatchingModule,
]

export function getInteractiveGameModule(id: string): InteractiveGameModule | undefined {
  return INTERACTIVE_GAME_MODULES.find((m) => m.id === id)
}
