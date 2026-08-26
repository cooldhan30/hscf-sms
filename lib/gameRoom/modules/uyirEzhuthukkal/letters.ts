// Single source of truth for the 12 Uyir Ezhuthukkal, used by both the
// order game and the memory game -- per explicit requirement, neither
// component hardcodes its own copy of this list.
export const UYIR_EZHUTHUKKAL = [
  'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ',
] as const

export type UyirEzhuthu = (typeof UYIR_EZHUTHUKKAL)[number]
