import { mc, orderLetters, orderWords, vocabQuiz, vocabMatch, type VocabWord } from '../builders'
import type { BuiltinTopicDef } from '../types'

// Reading, spelling, sentence-building and everyday-phrase topics. The
// picture/spelling words and their emoji hints come from the teacher-
// curated legacy word-formation bank (lib/gameRoom/modules/
// tamilWordFormation/words.ts); letter units are the same grapheme
// clusters that bank's segmenter produces. Emoji here are learning
// content (the picture the student reads from), not UI decoration.

const PICTURE_WORDS: { emoji: string; ta: string; units: string[]; en: string }[] = [
  { emoji: '🐴', ta: 'குதிரை', units: ['கு', 'தி', 'ரை'], en: 'Horse' },
  { emoji: '🐘', ta: 'யானை', units: ['யா', 'னை'], en: 'Elephant' },
  { emoji: '🦚', ta: 'மயில்', units: ['ம', 'யி', 'ல்'], en: 'Peacock' },
  { emoji: '🐸', ta: 'தவளை', units: ['த', 'வ', 'ளை'], en: 'Frog' },
  { emoji: '🦁', ta: 'சிங்கம்', units: ['சி', 'ங்', 'க', 'ம்'], en: 'Lion' },
  { emoji: '🏫', ta: 'பள்ளி', units: ['ப', 'ள்', 'ளி'], en: 'School' },
  { emoji: '✈️', ta: 'விமானம்', units: ['வி', 'மா', 'ன', 'ம்'], en: 'Airplane' },
  { emoji: '🚌', ta: 'பேருந்து', units: ['பே', 'ரு', 'ந்', 'து'], en: 'Bus' },
  { emoji: '☀️', ta: 'சூரியன்', units: ['சூ', 'ரி', 'ய', 'ன்'], en: 'Sun' },
  { emoji: '🌳', ta: 'மரம்', units: ['ம', 'ர', 'ம்'], en: 'Tree' },
  { emoji: '🐱', ta: 'பூனை', units: ['பூ', 'னை'], en: 'Cat' },
  { emoji: '🌙', ta: 'நிலா', units: ['நி', 'லா'], en: 'Moon' },
]

// Missing-letter items: which unit is blanked, and three distractors that
// do NOT form a real word in that position.
const MISSING_LETTER: { ta: string; emoji: string; en: string; index: number; distractors: string[] }[] = [
  { ta: 'குதிரை', emoji: '🐴', en: 'Horse', index: 1, distractors: ['டி', 'பி', 'சி'] },
  { ta: 'மயில்', emoji: '🦚', en: 'Peacock', index: 1, distractors: ['வி', 'லி', 'ரி'] },
  { ta: 'தவளை', emoji: '🐸', en: 'Frog', index: 1, distractors: ['ம', 'ய', 'ப'] },
  { ta: 'சிங்கம்', emoji: '🦁', en: 'Lion', index: 1, distractors: ['ண்', 'ன்', 'ம்'] },
  { ta: 'பள்ளி', emoji: '🏫', en: 'School', index: 1, distractors: ['ல்', 'ழ்', 'ண்'] },
  { ta: 'விமானம்', emoji: '✈️', en: 'Airplane', index: 1, distractors: ['கா', 'தா', 'பா'] },
  { ta: 'பேருந்து', emoji: '🚌', en: 'Bus', index: 1, distractors: ['லு', 'டு', 'கு'] },
  { ta: 'சூரியன்', emoji: '☀️', en: 'Sun', index: 2, distractors: ['வ', 'ர', 'ல'] },
  { ta: 'யானை', emoji: '🐘', en: 'Elephant', index: 1, distractors: ['ணை', 'லை', 'மை'] },
  { ta: 'குரங்கு', emoji: '🐒', en: 'Monkey', index: 1, distractors: ['ல', 'ள', 'ழ'] },
]

function unitsOf(word: string): string[] {
  const found = PICTURE_WORDS.find((w) => w.ta === word)
  if (found) return found.units
  if (word === 'குரங்கு') return ['கு', 'ர', 'ங்', 'கு']
  throw new Error(`No units for ${word}`)
}

export const WORD_READING_TOPIC: BuiltinTopicDef = {
  key: 'sol-padithal',
  tamilTitle: 'சொல் படித்தல்',
  englishTitle: 'Word Reading',
  description: 'Read a Tamil word and match it to its picture and meaning.',
  category: 'reading',
  difficulty: 'easy',
  level: 'mazhalai',
  sets: [
    {
      kind: 'quiz',
      title: 'சொல் படித்தல் -- Picture Quiz',
      questions: PICTURE_WORDS.map((w, i) =>
        mc(
          `${w.emoji} -- இது என்ன? சரியான சொல்லைப் படித்துத் தேர்ந்தெடுக்கவும் (What is this?)`,
          w.ta,
          [1, 4, 7].map((step) => PICTURE_WORDS[(i + step) % PICTURE_WORDS.length].ta)
        )
      ),
    },
    {
      kind: 'match',
      title: 'சொல் படித்தல் -- Picture Match',
      questions: [0, 4, 8].map((start) =>
        vocabMatchPictures(PICTURE_WORDS.slice(start, start + 4))
      ),
    },
  ],
}

function vocabMatchPictures(words: typeof PICTURE_WORDS) {
  return vocabMatch(words.map((w) => ({ ta: w.ta, en: `${w.emoji} ${w.en}` })), words.length)[0]
}

export const SPELLING_TOPIC: BuiltinTopicDef = {
  key: 'ezhuthu-kootal',
  tamilTitle: 'எழுத்துக் கூட்டல்',
  englishTitle: 'Spelling',
  description: 'Find the missing letter and build words letter by letter.',
  category: 'reading',
  difficulty: 'medium',
  level: 'grade-1',
  sets: [
    {
      kind: 'quiz',
      title: 'எழுத்துக் கூட்டல் -- Missing Letter',
      questions: MISSING_LETTER.map((item) => {
        const units = unitsOf(item.ta)
        const blanked = units.map((u, i) => (i === item.index ? '__' : u)).join('')
        return mc(`விடுபட்ட எழுத்து எது? ${blanked} (${item.emoji} ${item.en})`, units[item.index], item.distractors, `சரியான சொல்: ${item.ta}`)
      }),
    },
    {
      kind: 'order',
      title: 'எழுத்துக் கூட்டல் -- Build the Word',
      questions: PICTURE_WORDS.filter((w) => w.units.length >= 3 && new Set(w.units).size === w.units.length).map((w) =>
        orderLetters(`எழுத்துகளை வரிசைப்படுத்திச் சொல்லை உருவாக்குக: ${w.emoji} (${w.en})`, w.units)
      ),
    },
  ],
}

export const SENTENCE_READING_TOPIC: BuiltinTopicDef = {
  key: 'vakkiyam-padithal',
  tamilTitle: 'வாக்கியம் படித்தல்',
  englishTitle: 'Sentence Reading',
  description: 'Read a short sentence and answer a question about it.',
  category: 'reading',
  difficulty: 'medium',
  level: 'grade-2',
  sets: [
    {
      kind: 'quiz',
      title: 'வாக்கியம் படித்தல் -- Read & Answer',
      questions: [
        mc('"அம்மா சமையல் செய்கிறார்." -- யார் சமையல் செய்கிறார்?', 'அம்மா', ['அப்பா', 'தம்பி', 'பாட்டி']),
        mc('"கண்ணன் பந்து விளையாடுகிறான்." -- கண்ணன் என்ன விளையாடுகிறான்?', 'பந்து', ['பட்டம்', 'கோலி', 'ஊஞ்சல்']),
        mc('"மீனா பேருந்தில் பள்ளிக்குச் செல்கிறாள்." -- மீனா எதில் செல்கிறாள்?', 'பேருந்தில்', ['மிதிவண்டியில்', 'மகிழுந்தில்', 'படகில்']),
        mc('"தோட்டத்தில் சிவப்பு ரோஜா பூத்திருக்கிறது." -- ரோஜாவின் நிறம் என்ன?', 'சிவப்பு', ['மஞ்சள்', 'வெள்ளை', 'நீலம்']),
        mc('"பூனை மேசையின் கீழ் தூங்குகிறது." -- பூனை எங்கே தூங்குகிறது?', 'மேசையின் கீழ்', ['மரத்தின் மேல்', 'கட்டிலில்', 'வீட்டின் வெளியே']),
        mc('"ராமுவிடம் ஐந்து மாம்பழங்கள் உள்ளன." -- ராமுவிடம் எத்தனை மாம்பழங்கள் உள்ளன?', 'ஐந்து', ['மூன்று', 'நான்கு', 'ஆறு']),
        mc('"சூரியன் கிழக்கில் உதிக்கிறது." -- சூரியன் எந்தத் திசையில் உதிக்கிறது?', 'கிழக்கில்', ['மேற்கில்', 'வடக்கில்', 'தெற்கில்']),
        mc('"தாத்தா தினமும் செய்தித்தாள் படிக்கிறார்." -- தாத்தா என்ன படிக்கிறார்?', 'செய்தித்தாள்', ['கதைப்புத்தகம்', 'கடிதம்', 'பாடப்புத்தகம்']),
        mc('"மழை பெய்ததால் நாங்கள் வீட்டுக்குள் விளையாடினோம்." -- ஏன் வீட்டுக்குள் விளையாடினார்கள்?', 'மழை பெய்ததால்', ['வெயில் அடித்ததால்', 'இருட்டியதால்', 'பள்ளி விடுமுறை என்பதால்']),
        mc('"லதா தன் பாட்டிக்குக் கடிதம் எழுதினாள்." -- லதா யாருக்குக் கடிதம் எழுதினாள்?', 'பாட்டிக்கு', ['அம்மாவுக்கு', 'ஆசிரியருக்கு', 'தோழிக்கு']),
      ],
    },
  ],
}

export const SENTENCE_BUILDING_TOPIC: BuiltinTopicDef = {
  key: 'vakkiyam-amaithal',
  tamilTitle: 'வாக்கியம் அமைத்தல்',
  englishTitle: 'Sentence Building',
  description: 'Put the words in order to make a sentence.',
  category: 'sentences',
  difficulty: 'medium',
  level: 'grade-1',
  sets: [
    {
      kind: 'order',
      title: 'வாக்கியம் அமைத்தல் -- Word Order',
      questions: [
        ['நான்', 'பள்ளிக்குச்', 'செல்கிறேன்'],
        ['அம்மா', 'சோறு', 'சமைக்கிறார்'],
        ['பறவை', 'வானில்', 'பறக்கிறது'],
        ['தம்பி', 'பந்து', 'விளையாடுகிறான்'],
        ['நாங்கள்', 'தமிழ்', 'படிக்கிறோம்'],
        ['பூனை', 'பால்', 'குடிக்கிறது'],
        ['அப்பா', 'செய்தித்தாள்', 'படிக்கிறார்'],
        ['ஆசிரியர்', 'பாடம்', 'நடத்துகிறார்'],
      ].map((words) => orderWords('சொற்களை வரிசைப்படுத்தி வாக்கியம் அமைக்கவும் (Put the words in order)', words, words.join(' ') + '.')),
    },
  ],
}

export const AGREEMENT_TOPIC: BuiltinTopicDef = {
  key: 'sariyana-sol',
  tamilTitle: 'சரியான சொல்',
  englishTitle: 'Choose the Right Word',
  description: 'Complete each sentence with the verb that agrees with its subject and tense.',
  category: 'sentences',
  difficulty: 'medium',
  level: 'grade-2',
  sets: [
    {
      kind: 'quiz',
      title: 'சரியான சொல் -- Complete the Sentence',
      questions: [
        mc('நான் பள்ளிக்குச் ___.', 'செல்கிறேன்', ['செல்கிறான்', 'செல்கிறாள்', 'செல்கிறார்கள்'], 'நான் (தன்மை ஒருமை) → செல்கிறேன்.'),
        mc('அவள் பாட்டுப் ___.', 'பாடுகிறாள்', ['பாடுகிறான்', 'பாடுகிறேன்', 'பாடுகிறோம்'], 'அவள் (பெண்பால்) → பாடுகிறாள்.'),
        mc('அவர்கள் கால்பந்து ___.', 'விளையாடுகிறார்கள்', ['விளையாடுகிறான்', 'விளையாடுகிறது', 'விளையாடுகிறேன்'], 'அவர்கள் (பலர்பால்) → விளையாடுகிறார்கள்.'),
        mc('நாய் ___.', 'குரைக்கிறது', ['குரைக்கிறான்', 'குரைக்கிறாள்', 'குரைக்கிறேன்'], 'நாய் (ஒன்றன்பால்) → குரைக்கிறது.'),
        mc('நீ என்ன ___?', 'படிக்கிறாய்', ['படிக்கிறேன்', 'படிக்கிறான்', 'படிக்கிறது'], 'நீ (முன்னிலை) → படிக்கிறாய்.'),
        mc('நாங்கள் பூங்காவுக்குச் ___.', 'சென்றோம்', ['சென்றான்', 'சென்றாள்', 'சென்றது'], 'நாங்கள் (தன்மை பன்மை) → சென்றோம்.'),
        mc('நேற்று அப்பா கடைக்குச் ___.', 'சென்றார்', ['செல்வார்', 'செல்கிறார்', 'செல்லும்'], '"நேற்று" → இறந்தகாலம்: சென்றார்.'),
        mc('நாளை நாங்கள் கோயிலுக்குச் ___.', 'செல்வோம்', ['சென்றோம்', 'செல்கிறோம்', 'சென்றேன்'], '"நாளை" → எதிர்காலம்: செல்வோம்.'),
        mc('பறவைகள் வானில் ___.', 'பறக்கின்றன', ['பறக்கிறது', 'பறக்கிறான்', 'பறக்கிறாள்'], 'பறவைகள் (பலவின்பால்) → பறக்கின்றன.'),
        mc('மாணவர்கள் பாடம் ___.', 'படிக்கிறார்கள்', ['படிக்கிறான்', 'படிக்கிறது', 'படிக்கின்றன'], 'மாணவர்கள் (பலர்பால்) → படிக்கிறார்கள்.'),
      ],
    },
  ],
}

const PHRASES: VocabWord[] = [
  { ta: 'வணக்கம்', en: 'Hello' },
  { ta: 'நன்றி', en: 'Thank you' },
  { ta: 'மன்னிக்கவும்', en: 'Sorry' },
  { ta: 'தயவுசெய்து', en: 'Please' },
  { ta: 'காலை வணக்கம்', en: 'Good morning' },
  { ta: 'போய் வருகிறேன்', en: 'Goodbye' },
  { ta: 'நலமா?', en: 'How are you?' },
  { ta: 'நான் நலம்', en: 'I am fine' },
  { ta: 'ஆம்', en: 'Yes' },
  { ta: 'இல்லை', en: 'No' },
  { ta: 'உங்கள் பெயர் என்ன?', en: 'What is your name?' },
  { ta: 'சரி', en: 'Okay' },
]

export const PHRASES_TOPIC: BuiltinTopicDef = {
  key: 'anraada-pechu',
  tamilTitle: 'அன்றாடப் பேச்சு',
  englishTitle: 'Everyday Phrases',
  description: 'Greetings and polite words for every day.',
  category: 'everyday',
  difficulty: 'easy',
  level: 'mazhalai',
  sets: [
    {
      kind: 'quiz',
      title: 'அன்றாடப் பேச்சு -- Quiz',
      questions: [
        ...vocabQuiz(PHRASES),
        mc('ஒருவர் உங்களுக்கு உதவி செய்தால் என்ன சொல்வீர்கள்?', 'நன்றி', ['மன்னிக்கவும்', 'இல்லை', 'சரி']),
        mc('காலையில் ஆசிரியரைப் பார்த்தால் என்ன சொல்வீர்கள்?', 'காலை வணக்கம்', ['போய் வருகிறேன்', 'நன்றி', 'இல்லை']),
        mc('தவறுதலாக ஒருவர் மீது மோதிவிட்டால் என்ன சொல்வீர்கள்?', 'மன்னிக்கவும்', ['வணக்கம்', 'நன்றி', 'ஆம்']),
      ],
    },
    { kind: 'match', title: 'அன்றாடப் பேச்சு -- Phrase Match', questions: vocabMatch(PHRASES) },
  ],
}

export const READING_TOPICS: BuiltinTopicDef[] = [WORD_READING_TOPIC, SPELLING_TOPIC, SENTENCE_READING_TOPIC]
export const SENTENCE_TOPICS: BuiltinTopicDef[] = [SENTENCE_BUILDING_TOPIC, AGREEMENT_TOPIC]
export const EVERYDAY_EXTRA_TOPICS: BuiltinTopicDef[] = [PHRASES_TOPIC]
