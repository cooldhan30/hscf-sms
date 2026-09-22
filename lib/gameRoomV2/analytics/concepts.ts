// A STARTER catalog of Tamil grammar/phonetics concepts, for Builder UI
// autocomplete suggestions only -- concept_tags itself is free-text
// TEXT[] (migration 078), not constrained to this list, since teachers
// will inevitably want concepts beyond these 8 examples. This mirrors
// how sms_gamev2_question_sets.tags already works: a suggested
// vocabulary, never an enforced one.
export interface ConceptSuggestion {
  id: string
  tamilName: string
  englishName: string
  // Which learning dimension this concept typically belongs to --
  // shown as a hint in the Builder UI when a teacher picks a concept,
  // not enforced (a teacher can still tag a question with any
  // dimension/concept combination).
  typicalDimension: import('./dimensions').LearningDimension
}

export const CONCEPT_SUGGESTIONS: ConceptSuggestion[] = [
  { id: 'kuril-nedil', tamilName: 'குறில் / நெடில்', englishName: 'Short vs. long vowels', typicalDimension: 'grammar' },
  {
    id: 'vallinam-mellinam-idaiyinam',
    tamilName: 'வல்லினம் / மெல்லினம் / இடையினம்',
    englishName: 'Hard, soft, and medial consonants',
    typicalDimension: 'grammar',
  },
  { id: 'mayangoli', tamilName: 'மயங்கொலி', englishName: 'Easily-confused letter pairs', typicalDimension: 'spelling' },
  { id: 'thinai', tamilName: 'திணை', englishName: 'Rational/irrational noun class', typicalDimension: 'grammar' },
  { id: 'paal', tamilName: 'பால்', englishName: 'Gender', typicalDimension: 'grammar' },
  { id: 'yen', tamilName: 'எண்', englishName: 'Number (singular/plural)', typicalDimension: 'grammar' },
  { id: 'kaalam', tamilName: 'காலம்', englishName: 'Tense', typicalDimension: 'grammar' },
  { id: 'idam', tamilName: 'இடம்', englishName: 'Person (1st/2nd/3rd)', typicalDimension: 'grammar' },
]

export function getConceptSuggestion(id: string): ConceptSuggestion | undefined {
  return CONCEPT_SUGGESTIONS.find((c) => c.id === id)
}

// Looks up a suggestion by its Tamil display name too -- concept_tags
// on a question stores the display string itself (e.g. "திணை"), not an
// internal id, so a report rendering a raw tag can still recover the
// English gloss/typical dimension when the tag happens to match a
// known suggestion, while gracefully showing the raw tag as-is for any
// teacher-invented concept that isn't in this starter list.
export function getConceptSuggestionByTamilName(tamilName: string): ConceptSuggestion | undefined {
  return CONCEPT_SUGGESTIONS.find((c) => c.tamilName === tamilName)
}
