// Missing Letter: many choice questions already carry a blank in their
// prompt ("அ, ஆ, இ, ___ -- அடுத்த உயிரெழுத்து எது?"). The blank becomes the
// drop box the child drags a letter tile into. Prompts without one get a
// box of their own under the question.

// Two or more underscores, or an ellipsis used as a gap
const BLANK = /_{2,}|…/

export interface BlankParts {
  before: string
  after: string
}

export function splitAtBlank(prompt: string): BlankParts | null {
  const m = BLANK.exec(prompt)
  if (!m) return null
  return { before: prompt.slice(0, m.index), after: prompt.slice(m.index + m[0].length) }
}
