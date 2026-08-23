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

const PLACEHOLDER_EMOJI = '❓'

export function emojiForWord(word: string): string {
  return TAMIL_VOCAB_EMOJI[word] ?? PLACEHOLDER_EMOJI
}

export function availableVocabWords(): string[] {
  return Object.keys(TAMIL_VOCAB_EMOJI)
}
