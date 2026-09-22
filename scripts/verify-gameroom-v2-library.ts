// Standalone verification script for the Question Set Library's pure
// logic: language auto-detection (lib/gameRoomV2/domain/language.ts)
// and the "only compatible engines appear in Choose Your Game"
// filtering that both ChooseGameModal.tsx and LibrarySetCard.tsx build
// on (checkEngineCompatibility, already covered by
// verify-gameroom-v2-question-validation.ts's compatibility section --
// this script focuses on the NEW pieces this turn added). Same
// tsx-script convention as every other verify-gameroom-v2-*.ts script.
//
// Run with: npx tsx scripts/verify-gameroom-v2-library.ts

import { detectLanguage } from '../lib/gameRoomV2/domain/language'
import { checkEngineCompatibility } from '../lib/gameRoomV2/domain/compatibility'
import { GAME_ENGINES_V2 } from '../lib/gameRoomV2/registry'

let failures = 0

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    failures++
  } else {
    console.log(`  ok: ${message}`)
  }
}

console.log('== Language auto-detection ==')
assert(detectLanguage(['What is the capital of Tamil Nadu?']) === 'english', 'pure English text detected as english')
assert(detectLanguage(['தமிழ் நாட்டின் தலைநகரம் எது?']) === 'tamil', 'pure Tamil text detected as tamil')
assert(
  detectLanguage(['தமிழ் Grammar Question: திணை என்றால் என்ன?']) === 'mixed',
  'Tamil + English in the same text detected as mixed'
)
assert(detectLanguage(['1 + 1 = ?', '42']) === 'english', 'numbers-only content falls back to english, not misdetected as tamil')
assert(
  detectLanguage(['English title', 'தமிழ் தலைப்பு', 'ஒரு கேள்வி']) === 'mixed',
  'language is computed across ALL provided texts combined (title + prompts), not just the first one'
)
assert(detectLanguage([]) === 'english', 'empty input falls back to english rather than throwing')

console.log('\n== Choose Your Game only lists compatible engines ==')
// Mirrors ChooseGameModal.tsx's own filter: checkEngineCompatibility(...).filter(r => r.compatible)
function playableEngineIds(questionTypes: Parameters<typeof checkEngineCompatibility>[1]): string[] {
  return checkEngineCompatibility(GAME_ENGINES_V2, questionTypes)
    .filter((r) => r.compatible)
    .map((r) => r.engine.id)
}

const mcqOnly = playableEngineIds(['MULTIPLE_CHOICE'])
assert(mcqOnly.includes('classic-quiz'), 'a MULTIPLE_CHOICE-only set lists Classic Quiz as playable')
assert(!mcqOnly.includes('matching'), 'a MULTIPLE_CHOICE-only set does NOT list the Matching activity (unsupported type)')
assert(!mcqOnly.includes('crossword'), 'a MULTIPLE_CHOICE-only set does NOT list Crossword (unsupported type)')

const matchOnly = playableEngineIds(['MATCH'])
assert(matchOnly.includes('matching'), 'a MATCH-only set lists the Matching activity as playable')
assert(!matchOnly.includes('classic-quiz'), 'a MATCH-only set does NOT list Classic Quiz (unsupported type)')

const nothingPlayable = playableEngineIds(['PRONUNCIATION'])
assert(nothingPlayable.length === 0, 'a set with only an unimplemented question type has zero playable games -- never a fabricated launch target')

// Classic Quiz and Tower Defense are the real, playable (ACTIVE)
// engines so far -- every other engine is still COMING_SOON. Confirming
// this here (alongside verify-gameroom-v2-domain.ts) because it's the
// exact guarantee ChooseGameModal relies on: only ACTIVE/BETA engines
// are clickable, everything else shows an inert "Coming Soon" badge.
assert(
  GAME_ENGINES_V2.filter((e) => e.status !== 'COMING_SOON').every((e) => e.id === 'classic-quiz' || e.id === 'tower-defense'),
  'the only non-COMING_SOON engines are Classic Quiz and Tower Defense -- every other engine stays unimplemented'
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s).`)
process.exit(failures === 0 ? 0 : 1)
