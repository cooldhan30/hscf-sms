// Single source of truth for the Kuril/Nedil classification games --
// intentionally only 4 Kuril + 6 Nedil (not the full 5+7), a deliberate
// scope decision for a balanced game rather than the complete Tamil
// grammar classification.
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

  { letter: 'ஆ', type: 'nedil' },
  { letter: 'ஈ', type: 'nedil' },
  { letter: 'ஊ', type: 'nedil' },
  { letter: 'ஏ', type: 'nedil' },
  { letter: 'ஓ', type: 'nedil' },
  { letter: 'ஔ', type: 'nedil' },
]
