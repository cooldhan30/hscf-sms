// Single source of truth for the Ina Ezhuthukkal pairs (each Mei Ezhuthu
// matched with its corresponding Ina Ezhuthu) -- exactly 6 pairs.
export interface InaPair {
  mei: string
  ina: string
}

export const INA_EZHUTHUKKAL_PAIRS: InaPair[] = [
  { mei: 'க்', ina: 'ங்' },
  { mei: 'ச்', ina: 'ஞ்' },
  { mei: 'ட்', ina: 'ண்' },
  { mei: 'த்', ina: 'ந்' },
  { mei: 'ப்', ina: 'ம்' },
  { mei: 'ற்', ina: 'ன்' },
]
