// Single source of truth for the Vallinam/Mellinam/Idaiyinam
// classification of the 18 Mei Ezhuthukkal -- 6 letters per group.
export type MeiClassType = 'vallinam' | 'mellinam' | 'idaiyinam'

export interface MeiClassifiedLetter {
  letter: string
  type: MeiClassType
}

export const MEI_VALLINAM_MELLINAM_IDAIYINAM: MeiClassifiedLetter[] = [
  { letter: 'க்', type: 'vallinam' },
  { letter: 'ச்', type: 'vallinam' },
  { letter: 'ட்', type: 'vallinam' },
  { letter: 'த்', type: 'vallinam' },
  { letter: 'ப்', type: 'vallinam' },
  { letter: 'ற்', type: 'vallinam' },

  { letter: 'ங்', type: 'mellinam' },
  { letter: 'ஞ்', type: 'mellinam' },
  { letter: 'ண்', type: 'mellinam' },
  { letter: 'ந்', type: 'mellinam' },
  { letter: 'ம்', type: 'mellinam' },
  { letter: 'ன்', type: 'mellinam' },

  { letter: 'ய்', type: 'idaiyinam' },
  { letter: 'ர்', type: 'idaiyinam' },
  { letter: 'ல்', type: 'idaiyinam' },
  { letter: 'வ்', type: 'idaiyinam' },
  { letter: 'ழ்', type: 'idaiyinam' },
  { letter: 'ள்', type: 'idaiyinam' },
]
