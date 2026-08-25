// Standalone CLI check for every registered Game Room module's question
// bank -- run manually (npx tsx scripts/validate-game-room-questions.ts)
// before deploying a new/changed question bank. Module load itself
// already throws on any validation failure (see
// lib/gameRoom/modules/tamilGrammar/index.ts), so a clean exit here just
// confirms that; this script exists to give a clear, readable report a
// human can review, per the "report clearly, don't silently change"
// requirement.
import { GAME_MODULES } from '../lib/gameRoom/registry'

let hadError = false

for (const gameModule of GAME_MODULES) {
  console.log(`\n=== ${gameModule.name} (${gameModule.id}) ===`)
  try {
    const bank = gameModule.getQuestionBank()
    console.log(`OK -- ${bank.length} questions validated`)
    if (gameModule.categories) {
      for (const cat of gameModule.categories) {
        const count = bank.filter((q) => q.category === cat.id).length
        console.log(`  ${cat.label} (${cat.id}): ${count} questions`)
      }
    }
  } catch (err) {
    hadError = true
    console.error(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
  }
}

if (hadError) {
  console.error('\nValidation failed -- fix the reported issue(s) before deploying.')
  process.exit(1)
}

console.log('\nAll Game Room question banks validated successfully.')
