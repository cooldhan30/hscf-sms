// The Uyir Ezhuthukkal sequence used by the missing-letter game --
// identical to lib/gameRoom/modules/uyirEzhuthukkal/letters.ts, kept as
// its own import here so this module's data doesn't reach across into
// another game's module.
export { UYIR_EZHUTHUKKAL } from '@/lib/gameRoom/modules/uyirEzhuthukkal/letters'

// The Mei Ezhuthukkal sequence for THIS game specifically -- this
// worksheet-style missing-letter activity uses the interleaved
// Vallinam/Mellinam recitation order (க் ங் ச் ஞ் ...), which is
// different from lib/gameRoom/modules/meiEzhuthukkal/letters.ts's order
// (grouped Vallinam-then-Mellinam-then-Idaiyinam, க் ச் ட் ... ங் ஞ் ...)
// used by the existing Mei order/memory games. Both are valid Tamil
// letter orderings for different pedagogical purposes -- kept as a
// separate constant here rather than changing the existing games'
// canonical order, which would silently break their "correct order" it
// already relies on.
export const MEI_EZHUTHUKKAL_MISSING_LETTER_ORDER = [
  'க்', 'ங்', 'ச்', 'ஞ்', 'ட்', 'ண்',
  'த்', 'ந்', 'ப்', 'ம்', 'ய்', 'ர்',
  'ல்', 'வ்', 'ழ்', 'ள்', 'ற்', 'ன்',
] as const
