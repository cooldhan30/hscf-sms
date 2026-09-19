import { GRAMMAR_ENTRIES } from './wordBank'
import { buildGrammarEntry, type GrammarEntry } from './wordEntry'

// Built once at module load (same discipline as tamilGrammar/mayangoli)
// -- validates every entry eagerly so a bad row fails the build/boot
// loudly rather than surfacing as a broken question mid-game. Filters
// to enabled=true first (same order as mayangoli's selectWords.ts), so
// a disabled draft row never blocks the build even if it's malformed.
export const ALL_GRAMMAR_ENTRIES: GrammarEntry[] = GRAMMAR_ENTRIES.filter((e) => e.enabled).map(buildGrammarEntry)
