// A server-verifiable proxy for "this session counts as a strong clear
// of its engine," used only to decide engine-specific achievements
// (Tower Defender, Boss Slayer, Treasure Hunter, Checkered Flag, Word
// Master). In-game simulation state (wave number, boss defeated,
// treasure found, race won) is entirely client-side today across every
// non-quiz engine -- there is no server-verifiable signal for the
// narrative "did the player finish the level" event. Rather than trust
// a client-reported completion flag (a real, if low-stakes, gap in an
// "abuse protection" system), this computes a proxy ENTIRELY from
// numbers the server already persisted itself: every question in the
// session answered, every one of them correct, and no lives lost along
// the way. A player who legitimately mastered the content will clear
// this bar; a player who merely claims victory without truly engaging
// with the questions cannot fake it, since is_correct/lives are
// server-graded, never client-supplied.
export function computeEngineMilestone(session: {
  answeredCount: number
  totalQuestions: number
  correctCount: number
  lives: number
  maxLives: number
}): boolean {
  if (session.totalQuestions === 0) return false
  const fullyAnswered = session.answeredCount >= session.totalQuestions
  const allCorrect = session.correctCount === session.answeredCount
  const noLivesLost = session.maxLives === 0 || session.lives >= session.maxLives
  return fullyAnswered && allCorrect && noLivesLost
}
