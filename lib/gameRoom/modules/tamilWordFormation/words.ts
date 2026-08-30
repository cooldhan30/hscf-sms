import { segmentTamilWord } from './segmentation'

export type WordComplexity = 'easy' | 'medium' | 'hard'

export interface TamilWord {
  id: string
  word: string
  units: string[]
  unitCount: number
  complexity: WordComplexity
  meaningEnglish: string
  category: string
  hintEmoji: string | null
}

// Curated Nilai 1 word bank -- every word is a genuine, common Tamil
// word a young child already knows how to say, not a string invented
// to hit a target length. `units`/`unitCount` are derived automatically
// via segmentTamilWord (the Tamil-grapheme-cluster segmenter) rather
// than hardcoded, so they can never drift out of sync with the actual
// word. Complexity buckets are defined by unit count -- easy = 2,
// medium = 3, hard = 4 -- and every word below was individually
// verified against segmentTamilWord to land in its intended bucket
// (Tamil syllable structure means visual/character length does NOT
// predict unit count, so this can't be eyeballed).
interface WordSeed {
  word: string
  meaningEnglish: string
  category: string
  hintEmoji: string | null
}

// unitCount 2
const EASY_WORDS: WordSeed[] = [
  { word: 'பூனை', meaningEnglish: 'Cat', category: 'Animals', hintEmoji: '🐱' },
  { word: 'நாய்', meaningEnglish: 'Dog', category: 'Animals', hintEmoji: '🐶' },
  { word: 'மீன்', meaningEnglish: 'Fish', category: 'Animals', hintEmoji: '🐟' },
  { word: 'பசு', meaningEnglish: 'Cow', category: 'Animals', hintEmoji: '🐄' },
  { word: 'கிளி', meaningEnglish: 'Parrot', category: 'Animals', hintEmoji: '🦜' },
  { word: 'ஆடு', meaningEnglish: 'Goat', category: 'Animals', hintEmoji: '🐐' },
  { word: 'புலி', meaningEnglish: 'Tiger', category: 'Animals', hintEmoji: '🐯' },
  { word: 'எலி', meaningEnglish: 'Mouse', category: 'Animals', hintEmoji: '🐭' },
  { word: 'மான்', meaningEnglish: 'Deer', category: 'Animals', hintEmoji: '🦌' },
  { word: 'யானை', meaningEnglish: 'Elephant', category: 'Animals', hintEmoji: '🐘' },
  { word: 'வீடு', meaningEnglish: 'House', category: 'Objects', hintEmoji: '🏠' },
  { word: 'மேசை', meaningEnglish: 'Table', category: 'Objects', hintEmoji: '🪑' },
  { word: 'குடை', meaningEnglish: 'Umbrella', category: 'Objects', hintEmoji: '☂️' },
  { word: 'கார்', meaningEnglish: 'Car', category: 'Objects', hintEmoji: '🚗' },
  { word: 'பால்', meaningEnglish: 'Milk', category: 'Food', hintEmoji: '🥛' },
  { word: 'தேன்', meaningEnglish: 'Honey', category: 'Food', hintEmoji: '🍯' },
  { word: 'நெய்', meaningEnglish: 'Ghee', category: 'Food', hintEmoji: '🧈' },
  { word: 'தோசை', meaningEnglish: 'Dosa', category: 'Food', hintEmoji: '🥞' },
  { word: 'வாழை', meaningEnglish: 'Banana', category: 'Food', hintEmoji: '🍌' },
  { word: 'மாமா', meaningEnglish: 'Uncle', category: 'Family', hintEmoji: '👨' },
  { word: 'கால்', meaningEnglish: 'Leg', category: 'Body', hintEmoji: '🦵' },
  { word: 'காது', meaningEnglish: 'Ear', category: 'Body', hintEmoji: '👂' },
  { word: 'நிலா', meaningEnglish: 'Moon', category: 'Nature', hintEmoji: '🌙' },
  { word: 'மழை', meaningEnglish: 'Rain', category: 'Nature', hintEmoji: '🌧️' },
  { word: 'மலை', meaningEnglish: 'Mountain', category: 'Nature', hintEmoji: '⛰️' },
  { word: 'நதி', meaningEnglish: 'River', category: 'Nature', hintEmoji: '🏞️' },
  { word: 'பனி', meaningEnglish: 'Snow/Dew', category: 'Nature', hintEmoji: '❄️' },
  { word: 'ஆமை', meaningEnglish: 'Turtle', category: 'Animals', hintEmoji: '🐢' },
  { word: 'தேனீ', meaningEnglish: 'Bee', category: 'Animals', hintEmoji: '🐝' },
  { word: 'கோடை', meaningEnglish: 'Summer', category: 'Nature', hintEmoji: '☀️' },
]

// unitCount 3
const MEDIUM_WORDS: WordSeed[] = [
  { word: 'குதிரை', meaningEnglish: 'Horse', category: 'Animals', hintEmoji: '🐴' },
  { word: 'மயில்', meaningEnglish: 'Peacock', category: 'Animals', hintEmoji: '🦚' },
  { word: 'அணில்', meaningEnglish: 'Squirrel', category: 'Animals', hintEmoji: '🐿️' },
  { word: 'முயல்', meaningEnglish: 'Rabbit', category: 'Animals', hintEmoji: '🐇' },
  { word: 'பாம்பு', meaningEnglish: 'Snake', category: 'Animals', hintEmoji: '🐍' },
  { word: 'காகம்', meaningEnglish: 'Crow', category: 'Animals', hintEmoji: '🐦‍⬛' },
  { word: 'குயில்', meaningEnglish: 'Cuckoo', category: 'Animals', hintEmoji: '🐦' },
  { word: 'நண்டு', meaningEnglish: 'Crab', category: 'Animals', hintEmoji: '🦀' },
  { word: 'தவளை', meaningEnglish: 'Frog', category: 'Animals', hintEmoji: '🐸' },
  { word: 'பறவை', meaningEnglish: 'Bird', category: 'Animals', hintEmoji: '🐦' },
  { word: 'பள்ளி', meaningEnglish: 'School', category: 'School', hintEmoji: '🏫' },
  { word: 'வண்டி', meaningEnglish: 'Vehicle/Cart', category: 'Objects', hintEmoji: '🛺' },
  { word: 'படகு', meaningEnglish: 'Boat', category: 'Objects', hintEmoji: '⛵' },
  { word: 'ரயில்', meaningEnglish: 'Train', category: 'Objects', hintEmoji: '🚂' },
  { word: 'கத்தி', meaningEnglish: 'Knife', category: 'Objects', hintEmoji: '🔪' },
  { word: 'சட்டை', meaningEnglish: 'Shirt', category: 'Objects', hintEmoji: '👕' },
  { word: 'சாதம்', meaningEnglish: 'Cooked Rice', category: 'Food', hintEmoji: '🍚' },
  { word: 'உப்பு', meaningEnglish: 'Salt', category: 'Food', hintEmoji: '🧂' },
  { word: 'தயிர்', meaningEnglish: 'Curd', category: 'Food', hintEmoji: '🥣' },
  { word: 'இட்லி', meaningEnglish: 'Idli', category: 'Food', hintEmoji: '🍚' },
  { word: 'பழம்', meaningEnglish: 'Fruit', category: 'Food', hintEmoji: '🍎' },
  { word: 'காரம்', meaningEnglish: 'Spicy', category: 'Food', hintEmoji: '🌶️' },
  { word: 'உணவு', meaningEnglish: 'Food', category: 'Food', hintEmoji: '🍽️' },
  { word: 'தம்பி', meaningEnglish: 'Younger Brother', category: 'Family', hintEmoji: '👦' },
  { word: 'அக்கா', meaningEnglish: 'Older Sister', category: 'Family', hintEmoji: '👧' },
  { word: 'நண்பி', meaningEnglish: 'Friend (girl)', category: 'Family', hintEmoji: '🙋‍♀️' },
  { word: 'அத்தை', meaningEnglish: 'Aunt', category: 'Family', hintEmoji: '👩' },
  { word: 'மூக்கு', meaningEnglish: 'Nose', category: 'Body', hintEmoji: '👃' },
  { word: 'வயிறு', meaningEnglish: 'Stomach', category: 'Body', hintEmoji: '🫃' },
  { word: 'முதுகு', meaningEnglish: 'Back', category: 'Body', hintEmoji: '🦴' },
  { word: 'நகம்', meaningEnglish: 'Nail', category: 'Body', hintEmoji: '💅' },
  { word: 'மரம்', meaningEnglish: 'Tree', category: 'Nature', hintEmoji: '🌳' },
  { word: 'கடல்', meaningEnglish: 'Sea', category: 'Nature', hintEmoji: '🌊' },
  { word: 'வானம்', meaningEnglish: 'Sky', category: 'Nature', hintEmoji: '🌌' },
  { word: 'நிறம்', meaningEnglish: 'Color', category: 'Colors', hintEmoji: '🎨' },
  { word: 'பச்சை', meaningEnglish: 'Green', category: 'Colors', hintEmoji: '🟢' },
  { word: 'வெள்ளை', meaningEnglish: 'White', category: 'Colors', hintEmoji: '⚪' },
  { word: 'காற்று', meaningEnglish: 'Wind', category: 'Nature', hintEmoji: '💨' },
  { word: 'மணல்', meaningEnglish: 'Sand', category: 'Nature', hintEmoji: '🏖️' },
  { word: 'நிலம்', meaningEnglish: 'Land', category: 'Nature', hintEmoji: '🌾' },
  { word: 'இனிமை', meaningEnglish: 'Sweetness', category: 'Food', hintEmoji: '🍭' },
  { word: 'மாணவி', meaningEnglish: 'Student (girl)', category: 'School', hintEmoji: '👩‍🎓' },
]

// unitCount 4
const HARD_WORDS: WordSeed[] = [
  { word: 'குரங்கு', meaningEnglish: 'Monkey', category: 'Animals', hintEmoji: '🐒' },
  { word: 'சிங்கம்', meaningEnglish: 'Lion', category: 'Animals', hintEmoji: '🦁' },
  { word: 'எறும்பு', meaningEnglish: 'Ant', category: 'Animals', hintEmoji: '🐜' },
  { word: 'அன்னம்', meaningEnglish: 'Swan', category: 'Animals', hintEmoji: '🦢' },
  { word: 'நண்பன்', meaningEnglish: 'Friend (boy)', category: 'Family', hintEmoji: '🙋‍♂️' },
  { word: 'அண்ணன்', meaningEnglish: 'Older Brother', category: 'Family', hintEmoji: '👦' },
  { word: 'குழந்தை', meaningEnglish: 'Child (baby)', category: 'Family', hintEmoji: '👶' },
  { word: 'மாணவன்', meaningEnglish: 'Student (boy)', category: 'School', hintEmoji: '🧑‍🎓' },
  { word: 'நூலகம்', meaningEnglish: 'Library', category: 'School', hintEmoji: '📚' },
  { word: 'சூரியன்', meaningEnglish: 'Sun', category: 'Nature', hintEmoji: '☀️' },
  { word: 'நெருப்பு', meaningEnglish: 'Fire', category: 'Nature', hintEmoji: '🔥' },
  { word: 'தலைமுடி', meaningEnglish: 'Hair', category: 'Body', hintEmoji: '💇' },
  { word: 'சிவப்பு', meaningEnglish: 'Red', category: 'Colors', hintEmoji: '🔴' },
  { word: 'கருப்பு', meaningEnglish: 'Black', category: 'Colors', hintEmoji: '⚫' },
  { word: 'இனிப்பு', meaningEnglish: 'Sweet (candy)', category: 'Food', hintEmoji: '🍬' },
  { word: 'விமானம்', meaningEnglish: 'Airplane', category: 'Objects', hintEmoji: '✈️' },
  { word: 'சைக்கிள்', meaningEnglish: 'Bicycle', category: 'Objects', hintEmoji: '🚲' },
  { word: 'பேருந்து', meaningEnglish: 'Bus', category: 'Objects', hintEmoji: '🚌' },
  { word: 'அலமாரி', meaningEnglish: 'Cupboard', category: 'Objects', hintEmoji: '🗄️' },
  { word: 'நாற்காலி', meaningEnglish: 'Chair', category: 'Objects', hintEmoji: '🪑' },
]

function buildWords(seeds: WordSeed[], complexity: WordComplexity, prefix: string): TamilWord[] {
  return seeds.map((seed, i) => {
    const units = segmentTamilWord(seed.word)
    return {
      id: `${prefix}_${String(i + 1).padStart(3, '0')}`,
      word: seed.word,
      units,
      unitCount: units.length,
      complexity,
      meaningEnglish: seed.meaningEnglish,
      category: seed.category,
      hintEmoji: seed.hintEmoji,
    }
  })
}

export const TAMIL_WORDS: TamilWord[] = [
  ...buildWords(EASY_WORDS, 'easy', 'word_easy'),
  ...buildWords(MEDIUM_WORDS, 'medium', 'word_medium'),
  ...buildWords(HARD_WORDS, 'hard', 'word_hard'),
]

export function getWordsByComplexity(complexity: WordComplexity): TamilWord[] {
  return TAMIL_WORDS.filter((w) => w.complexity === complexity)
}
