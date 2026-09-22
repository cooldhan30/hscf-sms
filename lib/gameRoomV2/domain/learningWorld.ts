// A "Learning World" groups question sets/engines by broad Tamil-
// learning theme (letters, sounds, words, sentences, stories, and a
// mixed-challenge world) -- purely a navigational/visual grouping, not
// a gameplay concept. A world has no gameplay of its own: a student
// enters a world to see the games/question sets that belong to it.
// This is intentionally its own small domain type rather than a field
// on GameEngine, since a world is about CONTENT THEME, orthogonal to
// which engine plays it (an engine already declared reusable across
// unrelated worlds shouldn't need a "world" concept baked into it).
export interface LearningWorld {
  id: string
  name: string
  tamilName: string
  description: string
  // Which engine ids (from the V2 registry) are associated with this
  // world -- purely descriptive for the home screen; not an access
  // restriction of any kind.
  engineIds: string[]
}

export const LEARNING_WORLDS: LearningWorld[] = [
  {
    id: 'letters-world',
    name: 'Letters World',
    tamilName: 'எழுத்துலகம்',
    description: 'Uyir and mei letters -- recognizing, ordering, and matching the Tamil alphabet.',
    engineIds: ['memory', 'matching', 'crossword'],
  },
  {
    id: 'sounds-world',
    name: 'Sounds World',
    tamilName: 'ஒலியுலகம்',
    description: 'Pronunciation and phonetics -- how letters and letter groups actually sound.',
    engineIds: ['classic-quiz', 'word-ninja'],
  },
  {
    id: 'words-world',
    name: 'Words World',
    tamilName: 'சொல்லுலகம்',
    description: 'Vocabulary and word-formation -- building and recognizing whole words.',
    engineIds: ['word-ninja', 'treasure-quest', 'crossword'],
  },
  {
    id: 'sentence-world',
    name: 'Sentence World',
    tamilName: 'வாக்கிய உலகம்',
    description: 'Grammar and sentence structure -- திணை, பால், எண், இடம், காலம் and beyond.',
    engineIds: ['classic-quiz', 'boss-battle'],
  },
  {
    id: 'story-world',
    name: 'Story World',
    tamilName: 'கதை உலகம்',
    description: 'Reading comprehension and storytelling through Tamil narratives.',
    engineIds: ['mystery-mansion', 'treasure-quest'],
  },
  {
    id: 'tamil-challenge-world',
    name: 'Tamil Challenge',
    tamilName: 'தமிழ் சவால்',
    description: 'Mixed, harder challenges pulling from every world -- for students ready to be tested.',
    engineIds: ['tower-defense', 'boss-battle', 'racing', 'kingdom-builder', 'space-mission'],
  },
]

export function getLearningWorld(id: string): LearningWorld | undefined {
  return LEARNING_WORLDS.find((w) => w.id === id)
}
