// Lightweight, deterministic (non-LLM) sanity check for generated Tamil
// text -- catches word-merging bugs (e.g. "சிறிய" + "யானை" glued into
// "சிறியயானை") that slip past the LLM despite explicit prompt
// instructions not to do this. Real Tamil words are rarely more than
// ~12-14 characters; an unbroken run of Tamil script longer than this
// threshold is a strong signal that two or more words got merged.
const SUSPICIOUS_RUN_RE = /[஀-௿]{17,}/

export function looksProperlySpaced(text: string): boolean {
  return !SUSPICIOUS_RUN_RE.test(text)
}
