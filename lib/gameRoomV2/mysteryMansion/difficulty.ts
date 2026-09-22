// Mystery Mansion's Junior Detective/Detective/Master Detective --
// alters gameplay parameters only (whether a wrong answer costs a
// lead/hint token). Question difficulty always comes from the
// selected Question Set, never touched here -- the same separation
// every V2 engine establishes (see Treasure Quest/Space
// Mission/Kingdom Builder's difficulty.ts).
export type MysteryMansionDifficulty = 'junior' | 'detective' | 'master'

export interface MysteryMansionDifficultySettings {
  id: MysteryMansionDifficulty
  label: string
  description: string
  wrongAnswerCostsLead: boolean
}

export const MYSTERY_MANSION_DIFFICULTY_SETTINGS: MysteryMansionDifficultySettings[] = [
  {
    id: 'junior',
    label: 'Junior Detective',
    description: 'A gentle first case -- a wrong guess never costs you a lead.',
    wrongAnswerCostsLead: false,
  },
  {
    id: 'detective',
    label: 'Detective',
    description: 'The standard case -- a wrong guess costs a lead, but you always have more to find.',
    wrongAnswerCostsLead: true,
  },
  {
    id: 'master',
    label: 'Master Detective',
    description: 'A sharper case for a seasoned sleuth -- leads matter, but you can never truly get stuck.',
    wrongAnswerCostsLead: true,
  },
]

export function getMysteryMansionDifficultySettings(id: MysteryMansionDifficulty): MysteryMansionDifficultySettings {
  const d = MYSTERY_MANSION_DIFFICULTY_SETTINGS.find((s) => s.id === id)
  if (!d) throw new Error(`Unknown Mystery Mansion difficulty: ${id}`)
  return d
}
