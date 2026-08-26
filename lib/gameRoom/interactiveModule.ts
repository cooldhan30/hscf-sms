// A second, parallel game contract alongside GameModule (lib/gameRoom/
// gameModule.ts). GameModule is contractually single-select multiple
// choice -- one prompt, one correctAnswer, one atomic submission per
// question, which is exactly the shape sms_game_answers/the poll-and-
// submit-once client loop is built around. A drag-to-order task or a
// memory-match board isn't "a question with a correct answer" at all --
// it's one continuous whole-board interaction with its own completion
// condition, so it gets its own minimal contract instead of being forced
// into GameQuestion's shape. There is deliberately no getQuestionBank()
// here -- each interactive game generates its own board data via the
// shared, letter-set-parameterized generators in
// modules/tamilLetterGames/orderGame.ts and memoryGame.ts, not a bank
// the engine iterates.
export interface InteractiveGameModule {
  // Stored verbatim on sms_game_sessions.game_type, same as GameModule.id.
  id: string
  name: string
  description: string
  // Short Tamil instruction line shown at the top of the play screen.
  instructions: string
  maxScore: number
}
