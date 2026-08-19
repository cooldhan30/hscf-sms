// Single source of truth for Resource categorization -- category values,
// their subcategories, learning skills, difficulty, and format. Kept as
// plain data (not scattered across components or a DB-driven taxonomy
// table) so adding a new subcategory or format later is a one-line
// change here rather than a migration -- see the "data-driven, not
// hard-coded" requirement this was built against.

export const RESOURCE_CATEGORIES = [
  {
    value: 'learning-resources',
    label: 'Learning Resources',
    subcategories: [
      { value: 'reading-exercises', label: 'Reading Exercises' },
      { value: 'worksheets', label: 'Worksheets' },
      { value: 'writing-practice', label: 'Writing Practice' },
      { value: 'grammar', label: 'Grammar' },
      { value: 'vocabulary', label: 'Vocabulary' },
      { value: 'letters-alphabet', label: 'Letters & Alphabet' },
    ],
  },
  {
    value: 'practice-assessment',
    label: 'Practice & Assessment',
    subcategories: [
      { value: 'quizzes', label: 'Quizzes' },
      { value: 'games', label: 'Games' },
      { value: 'assessments', label: 'Assessments' },
      { value: 'tests', label: 'Tests' },
      { value: 'revision-materials', label: 'Revision Materials' },
      { value: 'practice-exercises', label: 'Practice Exercises' },
    ],
  },
  {
    value: 'stories-fun-learning',
    label: 'Stories & Fun Learning',
    subcategories: [
      { value: 'stories', label: 'Stories' },
      { value: 'moral-stories', label: 'Moral Stories' },
      { value: 'fables', label: 'Fables' },
      { value: 'tamil-theni', label: 'Tamil Theni' },
      { value: 'songs-rhymes', label: 'Songs & Rhymes' },
      { value: 'activities', label: 'Activities' },
      { value: 'crafts', label: 'Crafts' },
      { value: 'coloring-activities', label: 'Coloring Activities' },
    ],
  },
  {
    value: 'explore-learn',
    label: 'Explore & Learn',
    subcategories: [
      { value: 'tamil-culture-heritage', label: 'Tamil Culture & Heritage' },
      { value: 'animals-nature', label: 'Animals & Nature' },
      { value: 'science-facts', label: 'Science & Facts' },
      { value: 'places', label: 'Places' },
      { value: 'famous-people', label: 'Famous People' },
      { value: 'history', label: 'History' },
      { value: 'environment', label: 'Environment' },
      { value: 'inventions', label: 'Inventions' },
    ],
  },
  {
    value: 'teacher-resources',
    label: 'Teacher Resources',
    subcategories: [
      { value: 'lesson-plans', label: 'Lesson Plans' },
      { value: 'teaching-guides', label: 'Teaching Guides' },
      { value: 'classroom-materials', label: 'Classroom Materials' },
      { value: 'projects', label: 'Projects' },
      { value: 'assignments', label: 'Assignments' },
      { value: 'teaching-activities', label: 'Teaching Activities' },
    ],
  },
] as const

export type ResourceCategoryValue = (typeof RESOURCE_CATEGORIES)[number]['value']

export const UNCATEGORIZED = 'uncategorized'

export function subcategoriesFor(category: string | null): { value: string; label: string }[] {
  const found = RESOURCE_CATEGORIES.find((c) => c.value === category)
  return found ? [...found.subcategories] : []
}

export function categoryLabel(value: string | null): string {
  if (!value || value === UNCATEGORIZED) return 'Uncategorized'
  return RESOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export function subcategoryLabel(category: string | null, value: string | null): string | null {
  if (!value) return null
  return subcategoriesFor(category).find((s) => s.value === value)?.label ?? value
}

export const RESOURCE_SKILLS = [
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'listening', label: 'Listening' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'grammar', label: 'Grammar' },
] as const

export const RESOURCE_DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const

export const RESOURCE_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'worksheet', label: 'Worksheet' },
  { value: 'interactive', label: 'Interactive' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'document', label: 'Document' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'game', label: 'Game' },
] as const

// Suggested tags shown to speed up tagging -- the tags column itself is
// free-form text[], so a teacher can still type any tag beyond this list.
export const SUGGESTED_TAGS = [
  'Animals',
  'Nature',
  'Grammar',
  'Reading',
  'Beginner',
  'Festival',
  'Tamil Culture',
  'Science',
  'Vocabulary',
  'Printable',
]

export const QUICK_FILTERS: { label: string; category?: string; subcategory?: string }[] = [
  { label: 'All Resources' },
  { label: 'Reading', subcategory: 'reading-exercises' },
  { label: 'Worksheets', subcategory: 'worksheets' },
  { label: 'Stories', subcategory: 'stories' },
  { label: 'Tamil Theni', subcategory: 'tamil-theni' },
  { label: 'Grammar', subcategory: 'grammar' },
  { label: 'Vocabulary', subcategory: 'vocabulary' },
  { label: 'Quizzes', subcategory: 'quizzes' },
]
