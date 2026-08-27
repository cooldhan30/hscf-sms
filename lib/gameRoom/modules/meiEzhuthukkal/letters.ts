// Single source of truth for the 18 Mei Ezhuthukkal, in the standard
// interleaved recitation order (Vallinam/Mellinam pairs alternating,
// then Idaiyinam) -- used by both the order game (as the canonical
// target sequence) and the memory game. Do not confuse these with
// Uyir Ezhuthukkal (lib/gameRoom/modules/uyirEzhuthukkal) or Uyirmei
// Ezhuthukkal -- a different letter category entirely.
//
// Confirmed as a real bug: this previously used a grouped order
// (Vallinam block, then Mellinam block, then Idaiyinam block), which
// didn't match how students are taught to recite the sequence (க் ங்
// ச் ஞ்...) -- same order already used by the missing-letter game
// (see modules/missingLetterGames/letters.ts, which duplicates this
// exact sequence for its own module-isolation reasons).
export const MEI_EZHUTHUKKAL = [
  'க்', 'ங்', 'ச்', 'ஞ்', 'ட்', 'ண்',
  'த்', 'ந்', 'ப்', 'ம்', 'ய்', 'ர்',
  'ல்', 'வ்', 'ழ்', 'ள்', 'ற்', 'ன்',
] as const

export type MeiEzhuthu = (typeof MEI_EZHUTHUKKAL)[number]
