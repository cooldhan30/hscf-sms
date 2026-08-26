// Single source of truth for the 18 Mei Ezhuthukkal, in their correct
// Tamil alphabetical order -- used by both the order game (as the
// canonical target sequence) and the memory game. Do not confuse these
// with Uyir Ezhuthukkal (lib/gameRoom/modules/uyirEzhuthukkal) or
// Uyirmei Ezhuthukkal -- a different letter category entirely.
export const MEI_EZHUTHUKKAL = [
  'க்', 'ச்', 'ட்', 'த்', 'ப்', 'ற்',
  'ங்', 'ஞ்', 'ண்', 'ந்', 'ம்', 'ன்',
  'ய்', 'ர்', 'ல்', 'வ்', 'ழ்', 'ள்',
] as const

export type MeiEzhuthu = (typeof MEI_EZHUTHUKKAL)[number]
