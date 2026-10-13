import type { OrderQuestion } from './types'

// Tamil-aware letter splitting for Word Builder. A Tamil letter as a child
// sees it (கா, க், கௌ) is one or more Unicode code points; splitting by
// code point would tear the vowel sign or the pulli off its consonant.
// Intl.Segmenter splits into user-perceived characters (grapheme
// clusters), which keeps every uyirmei and mei letter whole. Text is NFC-
// normalised first so a decomposed கௌ (க + ெ + ௗ) and the composed one
// compare equal.

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('ta', { granularity: 'grapheme' }) : null

export function normalizeTamil(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

export function splitLetters(text: string): string[] {
  const s = normalizeTamil(text).replace(/ /g, '')
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment)
  // Fallback for very old browsers: attach combining marks to the letter before them.
  const mark = new RegExp('\\p{M}', 'u')
  const out: string[] = []
  for (const ch of Array.from(s)) {
    if (mark.test(ch) && out.length > 0) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

export function splitWords(text: string): string[] {
  const s = normalizeTamil(text)
  return s ? s.split(' ') : []
}

export function tilesFor(q: Pick<OrderQuestion, 'unit' | 'answer'>): string[] {
  return q.unit === 'letters' ? splitLetters(q.answer) : splitWords(q.answer)
}

export function joinTiles(tiles: string[], unit: OrderQuestion['unit']): string {
  return tiles.join(unit === 'letters' ? '' : ' ')
}

// "ta" when the text contains Tamil letters, so screen readers read it in
// Tamil (the portal's pages are declared English). Undefined otherwise.
const TAMIL_LETTERS = new RegExp(`[${String.fromCharCode(0x0b80)}-${String.fromCharCode(0x0bff)}]`)
export function tamilLang(text: string): 'ta' | undefined {
  return TAMIL_LETTERS.test(text) ? 'ta' : undefined
}
