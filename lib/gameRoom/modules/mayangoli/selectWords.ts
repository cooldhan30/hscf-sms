import { MAYANGOLI_WORDS } from './wordBank'
import { buildMayangoliWord, type MayangoliWord } from './wordEntry'

// Built once at module load (like tamilGrammar's bank) -- validates
// every entry eagerly so a bad word fails the build/boot loudly rather
// than surfacing as a broken question mid-game.
export const ALL_MAYANGOLI_WORDS: MayangoliWord[] = MAYANGOLI_WORDS.filter((w) => w.enabled).map(buildMayangoliWord)
