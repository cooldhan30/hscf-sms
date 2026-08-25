// Fisher-Yates -- unbiased, unlike the `.sort(() => Math.random() - 0.5)`
// idiom used elsewhere in this codebase (Tamil Theni's answer-option
// shuffle), which is a well-known biased shuffle. Used for all three
// randomization points in Game Room: session question-set selection,
// each player's personal question order, and each question's answer-
// option order at read time.
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
