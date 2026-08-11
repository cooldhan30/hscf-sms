// Matches the class-level vocabulary already established on the marketing
// site (app/classes/page.tsx, app/registration/page.tsx) so grade_level
// values stay consistent across both systems.
export const GRADE_LEVEL_OPTIONS = [
  { value: 'grade-1', label: 'Nilai 1' },
  { value: 'grade-2', label: 'Nilai 2' },
  { value: 'grade-3', label: 'Nilai 3' },
  { value: 'grade-4', label: 'Nilai 4' },
  { value: 'grade-5', label: 'Nilai 5' },
  { value: 'grade-6', label: 'Nilai 6' },
  { value: 'grade-7', label: 'Nilai 7' },
  { value: 'grade-8', label: 'Nilai 8' },
  { value: 'biliteracy-seal', label: 'Biliteracy Seal Course' },
  { value: 'tamil-diploma', label: 'Tamil Diploma Program' },
] as const
