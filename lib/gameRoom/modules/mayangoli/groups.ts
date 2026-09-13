// Mayangoli letter groups -- letters that sound similar/are commonly
// confused in spelling. Data-driven (not hardcoded per-group logic
// elsewhere) so a future group can be added here alone.
//
// Each letter is stored as its BARE consonant form (ழ, ள, ல, ன, ண, ந்,
// ர, ற) -- not always with a pulli. Confirmed by direct testing
// (Intl.Segmenter('ta', {granularity:'grapheme'})): the same
// consonant appears WITH a pulli when it closes a syllable with no
// following vowel (பந்து -> ப|ந்|து, தமிழ் -> த|மி|ழ்) and WITHOUT one
// when it carries an inherent/explicit vowel (பழம் -> ப|ழ|ம், மரம் ->
// ம|ர|ம்). A word's actual target grapheme is resolved at build time
// (see wordEntry.ts) by checking for either `letter` or `letter + புள்ளி`
// in the word's grapheme clusters, never assumed to be one fixed form.
export interface MayangoliGroup {
  id: string
  label: string
  letters: string[]
}

const PULLI = '்'

export const MAYANGOLI_GROUPS: MayangoliGroup[] = [
  { id: 'l_group', label: 'ல் / ள் / ழ்', letters: ['ல', 'ள', 'ழ'] },
  { id: 'n_group', label: 'ன் / ண் / ந்', letters: ['ன', 'ண', 'ந'] },
  { id: 'r_group', label: 'ர் / ற்', letters: ['ர', 'ற'] },
]

export function getMayangoliGroup(id: string): MayangoliGroup | undefined {
  return MAYANGOLI_GROUPS.find((g) => g.id === id)
}

export function getGroupForLetter(bareLetter: string): MayangoliGroup | undefined {
  return MAYANGOLI_GROUPS.find((g) => g.letters.includes(bareLetter))
}

// Display form for a group option/answer choice -- always shown with
// its pulli in the UI (ல், ள், ழ், ...), matching how the spec's own
// examples present answer choices, regardless of which form (bare or
// pulli) actually occurs in any given target word.
export function displayForm(bareLetter: string): string {
  return `${bareLetter}${PULLI}`
}

export { PULLI }
