// Curated Tamil word -> emoji lookup powering Picture Fill-in-the-Blank
// worksheets (see components/resources/PictureFillBlankWorksheet.tsx).
// Deliberately NOT ComfyUI-generated -- a Type A worksheet needs 5-8
// images, and generating that many per worksheet on the single shared
// home-server GPU (see app/api/story-image/generate/route.ts's
// MAX_QUEUE_DEPTH) would stall every other teacher's story/worksheet
// image request behind it. Emoji are instant, free, and render
// consistently everywhere.
//
// The word list here is also what the worksheet generation prompt is
// scoped to (see app/api/generate-worksheet/route.ts) -- the model is
// asked to pick words FROM this dictionary rather than inventing
// arbitrary vocabulary that would then fall back to the placeholder
// glyph. Grow this list as real usage surfaces more common words.
export const TAMIL_VOCAB_EMOJI: Record<string, string> = {
  // Animals
  'வாத்து': '🦆',
  'நாய்': '🐕',
  'பூனை': '🐈',
  'மாடு': '🐄',
  'ஆடு': '🐐',
  'குதிரை': '🐎',
  'யானை': '🐘',
  'சிங்கம்': '🦁',
  'புலி': '🐅',
  'குரங்கு': '🐒',
  'முயல்': '🐇',
  'ஆமை': '🐢',
  'மீன்': '🐟',
  'பாம்பு': '🐍',
  'நண்டு': '🦀',
  'தவளை': '🐸',
  'கிளி': '🦜',
  'மயில்': '🦚',
  'கோழி': '🐓',
  'வண்டு': '🐞',
  'தேனீ': '🐝',
  'பட்டாம்பூச்சி': '🦋',

  // Fruits & food
  'மாம்பழம்': '🥭',
  'வாழைப்பழம்': '🍌',
  'ஆப்பிள்': '🍎',
  'திராட்சை': '🍇',
  'தர்பூசணி': '🍉',
  'அன்னாசி': '🍍',
  'எலுமிச்சை': '🍋',
  'தேங்காய்': '🥥',
  'சாதம்': '🍚',
  'பால்': '🥛',
  'முட்டை': '🥚',
  'ரொட்டி': '🍞',

  // Household / school / everyday objects
  'புத்தகம்': '📖',
  'பேனா': '🖊️',
  'பென்சில்': '✏️',
  'பந்து': '⚽',
  'கார்': '🚗',
  'பேருந்து': '🚌',
  'வீடு': '🏠',
  'மரம்': '🌳',
  'பூ': '🌸',
  'சூரியன்': '☀️',
  'நிலா': '🌙',
  'மழை': '🌧️',
  'நட்சத்திரம்': '⭐',
  'குடை': '☂️',
  'கடிகாரம்': '⏰',
  'கண்ணாடி': '🪞',
}

export const PLACEHOLDER_EMOJI = '❓'

export function emojiForWord(word: string): string {
  return TAMIL_VOCAB_EMOJI[word] ?? PLACEHOLDER_EMOJI
}

// Only words with 2+ grapheme clusters can have one blanked out and
// still leave something behind -- a single-cluster word (e.g. பூ, one
// consonant+vowel-sign cluster) has nothing to blank.
const GRAPHEME_SEGMENTER = new Intl.Segmenter('ta', { granularity: 'grapheme' })

function graphemeClusters(word: string): string[] {
  // Array.from over the Segmenter's iterator, not a spread/for-of --
  // TS's lib.es2018+ types for Intl.Segmenter's Segments require
  // --target es2015+ (or --downlevelIteration) to spread/for-of
  // directly, which this project's tsconfig doesn't set.
  return Array.from(GRAPHEME_SEGMENTER.segment(word), (s) => s.segment)
}

export function availableVocabWords(): string[] {
  return Object.keys(TAMIL_VOCAB_EMOJI).filter((word) => graphemeClusters(word).length >= 2)
}

// Confirmed by direct testing that asking an LLM to blank out a letter
// and reconstruct the remainder itself produces nonsense in Tamil script
// (e.g. "நாய்" came back as unrelated garbage like "___ரி") -- Tamil
// consonant+vowel-sign combinations are multi-codepoint grapheme
// clusters, and the model doesn't reliably split/rejoin them correctly.
// This does the blanking deterministically instead: split into real
// grapheme clusters (Intl.Segmenter, not raw JS chars -- "நாய்" is
// ["நா","ய்"], not 4 separate letters), remove exactly one at random,
// and rejoin. The LLM's only job for this worksheet type is picking
// WHICH words fit the theme (see buildSystemPrompt in
// app/api/generate-worksheet/route.ts) -- never how to blank them.
export function blankOutOneLetter(word: string): { blankedWord: string; missingLetter: string } | null {
  const clusters = graphemeClusters(word)
  if (clusters.length < 2) return null

  const index = Math.floor(Math.random() * clusters.length)
  const missingLetter = clusters[index]
  const blankedWord = clusters.map((c, i) => (i === index ? '___' : c)).join('')
  return { blankedWord, missingLetter }
}
