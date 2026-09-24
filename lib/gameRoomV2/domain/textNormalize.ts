// Normalizes free-typed text (a student's TEXT_INPUT/FILL_BLANK answer,
// or a teacher's MULTIPLE_CHOICE option list) for equality comparison
// only -- never for storage or display. Two concrete Tamil-correctness
// bugs this guards against:
//
// 1. Zero-width joiner/non-joiner variance: some Tamil keyboards/IMEs
//    insert a ZWJ (U+200D) or ZWNJ (U+200C) around certain conjuncts
//    (e.g. ஸ்ரீ can be typed as ஸ + ் + ZWJ + ர + ீ or as ஸ + ் + ர + ீ)
//    -- both render IDENTICALLY on screen, but a plain === comparison
//    treats them as different strings, so a student typing a visually-
//    correct answer with a different ZWJ than the teacher's stored
//    answer key would be marked wrong.
// 2. Composed/decomposed Unicode form drift: unlikely for Tamil itself
//    (the Tamil block has no precomposed/decomposed pairs the way
//    Latin accented Latin characters do -- see this file's own verify
//    script for a demonstration), but NFC normalization is applied
//    anyway as free, harmless defense-in-depth for any Latin content
//    mixed into an otherwise-Tamil answer.
//
// Deliberately NOT used for TEXT_INPUT/FILL_BLANK's own stored
// acceptedAnswers or for anything the student SEES -- only at the
// moment of comparing a submission against them. The raw text a teacher
// typed and a student typed are both stored and displayed completely
// unmodified everywhere else (see TamilTextInput.tsx's own header
// comment: "no transliteration, no normalization, no stripping").
const ZERO_WIDTH_JOINERS = /[​‌‍]/g

export function normalizeForComparison(text: string): string {
  return text.normalize('NFC').replace(ZERO_WIDTH_JOINERS, '')
}
