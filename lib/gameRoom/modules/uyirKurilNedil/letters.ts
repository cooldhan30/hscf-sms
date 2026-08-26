// Single source of truth for the Kuril/Nedil classification games --
// the complete Tamil classification: 5 Kuril + 7 Nedil = all 12 Uyir
// Ezhuthukkal.
export type KurilNedilType = 'kuril' | 'nedil'

export interface UyirKurilNedilLetter {
  letter: string
  type: KurilNedilType
}

export const UYIR_KURIL_NEDIL: UyirKurilNedilLetter[] = [
  { letter: 'அ', type: 'kuril' },
  { letter: 'இ', type: 'kuril' },
  { letter: 'உ', type: 'kuril' },
  { letter: 'எ', type: 'kuril' },
  { letter: 'ஒ', type: 'kuril' },

  { letter: 'ஆ', type: 'nedil' },
  { letter: 'ஈ', type: 'nedil' },
  { letter: 'ஊ', type: 'nedil' },
  { letter: 'ஏ', type: 'nedil' },
  { letter: 'ஐ', type: 'nedil' },
  { letter: 'ஓ', type: 'nedil' },
  { letter: 'ஔ', type: 'nedil' },
]
