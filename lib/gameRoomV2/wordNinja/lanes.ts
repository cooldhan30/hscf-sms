// Word Ninja's reusable content model: it renders ANY CATEGORIZE
// question (items + categories + a hidden answerKey it never sees) as
// N lanes -- one per category -- with each item flying down the middle
// waiting to be slashed into the lane the player believes it belongs
// in. This is deliberately generic over category count: a 2-category
// question (ஒருமை/பன்மை) and a 5-category question both use the exact
// same lane mechanic, so "support these 5 grammar categories" is
// entirely a teacher-authoring concern (which CATEGORIZE sets exist in
// the library), never something hardcoded in this engine -- the same
// content/gameplay separation every other V2 engine holds to.
//
// Grading is still 100% server-side and all-or-nothing on the full
// item->category mapping (gradeAnswer's existing CATEGORIZE case,
// unchanged) -- this file only decides how to LAY OUT lanes and
// SCHEDULE word flights; it never sees or guesses the answer key.
export interface LaneDefinition {
  category: string
  index: number
}

export function buildLanes(categories: string[]): LaneDefinition[] {
  return categories.map((category, index) => ({ category, index }))
}

export interface FlyingWord {
  id: string
  item: string
  // Populated once the player slashes it into a lane -- undefined
  // means "still in flight, not yet assigned."
  assignedCategory: string | undefined
}

export function createFlyingWords(items: string[]): FlyingWord[] {
  return items.map((item, i) => ({ id: `${i}-${item}`, item, assignedCategory: undefined }))
}

export function assignWordToLane(words: FlyingWord[], wordId: string, category: string): FlyingWord[] {
  return words.map((w) => (w.id === wordId ? { ...w, assignedCategory: category } : w))
}

export function allWordsAssigned(words: FlyingWord[]): boolean {
  return words.length > 0 && words.every((w) => w.assignedCategory !== undefined)
}

// Builds the final CATEGORIZE-shaped submission (Record<item,
// category>) from resolved flying words -- the exact same shape
// CategorizeInput's dropdown form already submits, so gradeAnswer needs
// no changes to grade a Word Ninja round.
export function buildCategorizeSubmission(words: FlyingWord[]): Record<string, string> {
  const submission: Record<string, string> = {}
  for (const word of words) {
    if (word.assignedCategory !== undefined) submission[word.item] = word.assignedCategory
  }
  return submission
}
