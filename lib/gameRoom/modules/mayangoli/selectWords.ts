import { MAYANGOLI_WORDS } from './wordBank'
import { buildMayangoliWord, type MayangoliWord, type MayangoliDifficulty, type ReviewStatus } from './wordEntry'
import { shuffle } from '@/lib/gameRoom/shuffle'

// Built once at module load (like tamilGrammar's bank) -- validates
// every entry eagerly so a bad word fails the build/boot loudly rather
// than surfacing as a broken question mid-game. This is the bank WITHOUT
// any admin overrides applied -- session creation must apply
// applyMayangoliWordOverrides() first so a teacher's disable/review
// action (sms_mayangoli_word_overrides) is actually honored.
export const ALL_MAYANGOLI_WORDS: MayangoliWord[] = MAYANGOLI_WORDS.filter((w) => w.enabled).map(buildMayangoliWord)

// Every word regardless of the static file's own `enabled` flag -- used
// by the admin browse screen so a word an admin override has disabled
// (even one the static file marks enabled, or vice-versa) is still
// visible and re-toggleable, rather than silently disappearing from the
// list the moment it's turned off.
export const ALL_MAYANGOLI_WORDS_INCLUDING_DISABLED: MayangoliWord[] = MAYANGOLI_WORDS.map(buildMayangoliWord)

export function getMayangoliWordById(id: string): MayangoliWord | undefined {
  return ALL_MAYANGOLI_WORDS.find((w) => w.id === id)
}

export interface MayangoliWordOverrideRow {
  word_id: string
  review_status: ReviewStatus | null
  enabled: boolean | null
  meaning_english_override: string | null
  meaning_tamil_override: string | null
}

// Overlays admin overrides (sms_mayangoli_word_overrides) onto the
// static, build-validated word bank -- a missing/null override field
// falls back to the static file's own value, so seeding the table is
// never required. Distractors/grapheme shape/target letter are NEVER
// overridable here (those are validated at build time against the
// actual word text; a text edit there would require regenerating and
// reverifying the whole entry, which is out of scope for a review
// screen that's meant for correcting metadata, not authoring words).
export function applyMayangoliWordOverrides(
  words: MayangoliWord[],
  overrides: MayangoliWordOverrideRow[]
): MayangoliWord[] {
  const overrideById = new Map(overrides.map((o) => [o.word_id, o]))
  return words.map((w) => {
    const o = overrideById.get(w.id)
    if (!o) return w
    return {
      ...w,
      reviewStatus: o.review_status ?? w.reviewStatus,
      enabled: o.enabled ?? w.enabled,
      meaningEnglish: o.meaning_english_override ?? w.meaningEnglish,
      meaningTamil: o.meaning_tamil_override ?? w.meaningTamil,
    }
  })
}

export class InvalidMayangoliConfigError extends Error {}

export interface MayangoliSessionConfig {
  groupIds: string[]
  difficulties: MayangoliDifficulty[]
  count: number
}

// Selects the FIXED word set for a whole session (every player in the
// room answers questions built from this same set, at the same room-
// wide pace) -- mirrors selectSessionQuestions's "randomize once,
// persist" contract for the existing engine. `words` should already
// have admin overrides applied and disabled words filtered out (see
// applyMayangoliWordOverrides + the /api/mayangoli/sessions route,
// which loads overrides once per session-creation request) -- kept as
// a parameter rather than hardcoded to ALL_MAYANGOLI_WORDS so callers
// control override freshness; defaults to the static bank for tests/
// scripts that don't need DB overrides.
export function selectMayangoliWords(
  config: MayangoliSessionConfig,
  words: MayangoliWord[] = ALL_MAYANGOLI_WORDS
): MayangoliWord[] {
  const pool = words.filter(
    (w) => w.enabled && config.groupIds.includes(w.groupId) && config.difficulties.includes(w.difficulty)
  )

  if (pool.length === 0) {
    throw new InvalidMayangoliConfigError('No words match the selected groups/difficulty')
  }
  if (pool.length < config.count) {
    throw new InvalidMayangoliConfigError(
      `Only ${pool.length} words available for the selected groups/difficulty, but ${config.count} were requested`
    )
  }

  return shuffle(pool).slice(0, config.count)
}
