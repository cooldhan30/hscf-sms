// The platform abstraction every Game Room game type implements. The
// session/scoring/leaderboard/reconnection engine (lib/gameRoom/*, the
// database schema, and every API route) is 100% game-agnostic -- it only
// ever deals with GameQuestion/GameModule shapes, never anything
// Tamil-grammar-specific. Adding a second game later means writing a new
// module and registering it (lib/gameRoom/registry.ts), not touching any
// of that shared machinery.
export interface GameQuestion {
  // Globally unique within the module, namespaced with the module id
  // (e.g. "tamil-grammar:tan_001") so sms_game_answers.question_id is
  // unambiguous across every module without a DB foreign key -- there is
  // no questions table; question banks live in app code (see
  // lib/gameRoom/modules/*).
  id: string
  // What's rendered as the question itself, e.g. a blanked word.
  prompt: string
  correctAnswer: string
  // All answer choices, including correctAnswer, in a fixed canonical
  // order -- shuffled per-read (per student, per question) by the
  // engine via lib/gameRoom/shuffle.ts, never pre-shuffled here.
  options: string[]
  explanation: string
  // Optional -- only modules with a category concept (like the Tamil
  // grammar quiz's three consonant rules) populate this; used for
  // category-filtered quiz modes and per-category accuracy stats.
  category?: string
}

export interface GameModule {
  // Stored verbatim on sms_game_sessions.game_type -- validated against
  // the registry at the API layer, not a DB CHECK, so a new module never
  // needs a migration.
  id: string
  name: string
  description: string
  categories?: { id: string; label: string }[]
  getQuestionBank(): GameQuestion[]
}
