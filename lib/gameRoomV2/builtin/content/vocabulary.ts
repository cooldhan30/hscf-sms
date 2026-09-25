import { mc, sort, vocabQuiz, vocabMatch, type VocabWord } from '../builders'
import type { BuiltinTopicDef, TopicCategory } from '../types'

// Everyday Tamil vocabulary. Core words overlap with the teacher-curated
// legacy word-formation bank (lib/gameRoom/modules/tamilWordFormation/
// words.ts: பூனை, யானை, மயில், குதிரை, ...); each topic here is a small,
// common, child-appropriate list with a plain English gloss.

const BODY: VocabWord[] = [
  { ta: 'தலை', en: 'Head' },
  { ta: 'கண்', en: 'Eye' },
  { ta: 'காது', en: 'Ear' },
  { ta: 'மூக்கு', en: 'Nose' },
  { ta: 'வாய்', en: 'Mouth' },
  { ta: 'பல்', en: 'Tooth' },
  { ta: 'கை', en: 'Hand' },
  { ta: 'கால்', en: 'Leg' },
  { ta: 'விரல்', en: 'Finger' },
  { ta: 'முடி', en: 'Hair' },
  { ta: 'நாக்கு', en: 'Tongue' },
  { ta: 'வயிறு', en: 'Stomach' },
]

const ANIMALS: VocabWord[] = [
  { ta: 'நாய்', en: 'Dog' },
  { ta: 'பூனை', en: 'Cat' },
  { ta: 'பசு', en: 'Cow' },
  { ta: 'ஆடு', en: 'Goat' },
  { ta: 'குதிரை', en: 'Horse' },
  { ta: 'யானை', en: 'Elephant' },
  { ta: 'சிங்கம்', en: 'Lion' },
  { ta: 'புலி', en: 'Tiger' },
  { ta: 'குரங்கு', en: 'Monkey' },
  { ta: 'முயல்', en: 'Rabbit' },
  { ta: 'மான்', en: 'Deer' },
  { ta: 'கரடி', en: 'Bear' },
]

const BIRDS: VocabWord[] = [
  { ta: 'காகம்', en: 'Crow' },
  { ta: 'கிளி', en: 'Parrot' },
  { ta: 'மயில்', en: 'Peacock' },
  { ta: 'குயில்', en: 'Cuckoo' },
  { ta: 'புறா', en: 'Pigeon' },
  { ta: 'கோழி', en: 'Hen' },
  { ta: 'வாத்து', en: 'Duck' },
  { ta: 'ஆந்தை', en: 'Owl' },
  { ta: 'கழுகு', en: 'Eagle' },
  { ta: 'அன்னம்', en: 'Swan' },
  { ta: 'குருவி', en: 'Sparrow' },
  { ta: 'கொக்கு', en: 'Crane' },
]

const FRUITS: VocabWord[] = [
  { ta: 'மாம்பழம்', en: 'Mango' },
  { ta: 'வாழைப்பழம்', en: 'Banana' },
  { ta: 'ஆப்பிள்', en: 'Apple' },
  { ta: 'திராட்சை', en: 'Grapes' },
  { ta: 'பலாப்பழம்', en: 'Jackfruit' },
  { ta: 'மாதுளை', en: 'Pomegranate' },
  { ta: 'கொய்யா', en: 'Guava' },
  { ta: 'அன்னாசி', en: 'Pineapple' },
  { ta: 'தர்பூசணி', en: 'Watermelon' },
  { ta: 'பப்பாளி', en: 'Papaya' },
  { ta: 'எலுமிச்சை', en: 'Lemon' },
  { ta: 'ஆரஞ்சு', en: 'Orange' },
]

const VEGETABLES: VocabWord[] = [
  { ta: 'கத்தரிக்காய்', en: 'Eggplant' },
  { ta: 'வெண்டைக்காய்', en: 'Okra' },
  { ta: 'தக்காளி', en: 'Tomato' },
  { ta: 'உருளைக்கிழங்கு', en: 'Potato' },
  { ta: 'வெங்காயம்', en: 'Onion' },
  { ta: 'கேரட்', en: 'Carrot' },
  { ta: 'முட்டைக்கோஸ்', en: 'Cabbage' },
  { ta: 'பூசணிக்காய்', en: 'Pumpkin' },
  { ta: 'பாகற்காய்', en: 'Bitter gourd' },
  { ta: 'முருங்கைக்காய்', en: 'Drumstick' },
  { ta: 'மிளகாய்', en: 'Chilli' },
  { ta: 'வெள்ளரிக்காய்', en: 'Cucumber' },
]

const COLORS: VocabWord[] = [
  { ta: 'சிவப்பு', en: 'Red' },
  { ta: 'பச்சை', en: 'Green' },
  { ta: 'நீலம்', en: 'Blue' },
  { ta: 'மஞ்சள்', en: 'Yellow' },
  { ta: 'வெள்ளை', en: 'White' },
  { ta: 'கருப்பு', en: 'Black' },
  { ta: 'ஊதா', en: 'Purple' },
  { ta: 'இளஞ்சிவப்பு', en: 'Pink' },
  { ta: 'பழுப்பு', en: 'Brown' },
  { ta: 'சாம்பல்', en: 'Grey' },
]

const NUMBERS: VocabWord[] = [
  { ta: 'ஒன்று', en: '1' },
  { ta: 'இரண்டு', en: '2' },
  { ta: 'மூன்று', en: '3' },
  { ta: 'நான்கு', en: '4' },
  { ta: 'ஐந்து', en: '5' },
  { ta: 'ஆறு', en: '6' },
  { ta: 'ஏழு', en: '7' },
  { ta: 'எட்டு', en: '8' },
  { ta: 'ஒன்பது', en: '9' },
  { ta: 'பத்து', en: '10' },
  { ta: 'இருபது', en: '20' },
  { ta: 'நூறு', en: '100' },
]

const FAMILY: VocabWord[] = [
  { ta: 'அம்மா', en: 'Mother' },
  { ta: 'அப்பா', en: 'Father' },
  { ta: 'அண்ணன்', en: 'Older brother' },
  { ta: 'அக்கா', en: 'Older sister' },
  { ta: 'தம்பி', en: 'Younger brother' },
  { ta: 'தங்கை', en: 'Younger sister' },
  { ta: 'தாத்தா', en: 'Grandfather' },
  { ta: 'பாட்டி', en: 'Grandmother' },
  { ta: 'மாமா', en: 'Uncle' },
  { ta: 'அத்தை', en: 'Aunt' },
  { ta: 'குழந்தை', en: 'Baby' },
  { ta: 'குடும்பம்', en: 'Family' },
]

const SCHOOL: VocabWord[] = [
  { ta: 'பள்ளி', en: 'School' },
  { ta: 'ஆசிரியர்', en: 'Teacher' },
  { ta: 'மாணவன்', en: 'Student (boy)' },
  { ta: 'மாணவி', en: 'Student (girl)' },
  { ta: 'புத்தகம்', en: 'Book' },
  { ta: 'பேனா', en: 'Pen' },
  { ta: 'வகுப்பறை', en: 'Classroom' },
  { ta: 'கரும்பலகை', en: 'Blackboard' },
  { ta: 'மேசை', en: 'Desk' },
  { ta: 'நாற்காலி', en: 'Chair' },
  { ta: 'நூலகம்', en: 'Library' },
  { ta: 'பை', en: 'Bag' },
]

const HOME: VocabWord[] = [
  { ta: 'வீடு', en: 'House' },
  { ta: 'கதவு', en: 'Door' },
  { ta: 'சன்னல்', en: 'Window' },
  { ta: 'அறை', en: 'Room' },
  { ta: 'சமையலறை', en: 'Kitchen' },
  { ta: 'படுக்கையறை', en: 'Bedroom' },
  { ta: 'கூரை', en: 'Roof' },
  { ta: 'சுவர்', en: 'Wall' },
  { ta: 'விளக்கு', en: 'Lamp' },
  { ta: 'கடிகாரம்', en: 'Clock' },
  { ta: 'மின்விசிறி', en: 'Fan' },
  { ta: 'தொலைக்காட்சி', en: 'Television' },
]

const FOOD: VocabWord[] = [
  { ta: 'சோறு', en: 'Cooked rice' },
  { ta: 'இட்லி', en: 'Idli' },
  { ta: 'தோசை', en: 'Dosa' },
  { ta: 'சாம்பார்', en: 'Sambar' },
  { ta: 'தயிர்', en: 'Yogurt' },
  { ta: 'பால்', en: 'Milk' },
  { ta: 'முட்டை', en: 'Egg' },
  { ta: 'தண்ணீர்', en: 'Water' },
  { ta: 'உப்பு', en: 'Salt' },
  { ta: 'சர்க்கரை', en: 'Sugar' },
  { ta: 'தேன்', en: 'Honey' },
  { ta: 'வடை', en: 'Vada' },
]

const NATURE: VocabWord[] = [
  { ta: 'சூரியன்', en: 'Sun' },
  { ta: 'நிலா', en: 'Moon' },
  { ta: 'நட்சத்திரம்', en: 'Star' },
  { ta: 'வானம்', en: 'Sky' },
  { ta: 'மேகம்', en: 'Cloud' },
  { ta: 'மழை', en: 'Rain' },
  { ta: 'மலை', en: 'Mountain' },
  { ta: 'நதி', en: 'River' },
  { ta: 'கடல்', en: 'Sea' },
  { ta: 'மரம்', en: 'Tree' },
  { ta: 'பூ', en: 'Flower' },
  { ta: 'இலை', en: 'Leaf' },
]

const JOBS: VocabWord[] = [
  { ta: 'ஆசிரியர்', en: 'Teacher' },
  { ta: 'மருத்துவர்', en: 'Doctor' },
  { ta: 'விவசாயி', en: 'Farmer' },
  { ta: 'காவலர்', en: 'Police officer' },
  { ta: 'ஓட்டுநர்', en: 'Driver' },
  { ta: 'சமையல்காரர்', en: 'Cook' },
  { ta: 'தையல்காரர்', en: 'Tailor' },
  { ta: 'மீனவர்', en: 'Fisherman' },
  { ta: 'தச்சர்', en: 'Carpenter' },
  { ta: 'செவிலியர்', en: 'Nurse' },
  { ta: 'பொறியாளர்', en: 'Engineer' },
  { ta: 'வணிகர்', en: 'Shopkeeper' },
]

const TRANSPORT: VocabWord[] = [
  { ta: 'பேருந்து', en: 'Bus' },
  { ta: 'மகிழுந்து', en: 'Car' },
  { ta: 'மிதிவண்டி', en: 'Bicycle' },
  { ta: 'தொடர்வண்டி', en: 'Train' },
  { ta: 'விமானம்', en: 'Airplane' },
  { ta: 'கப்பல்', en: 'Ship' },
  { ta: 'படகு', en: 'Boat' },
  { ta: 'மாட்டுவண்டி', en: 'Bullock cart' },
  { ta: 'சரக்குந்து', en: 'Truck' },
]

// A topic with a meaning quiz, matching rounds, and optionally extra
// concept questions and/or a sorting set.
function vocabTopic(opts: {
  key: string
  tamilTitle: string
  englishTitle: string
  description: string
  words: VocabWord[]
  difficulty?: 'easy' | 'medium' | 'hard'
  level?: string
  category?: TopicCategory
  extraQuiz?: ReturnType<typeof mc>[]
  sortSet?: { title: string; questions: ReturnType<typeof sort>[] }
}): BuiltinTopicDef {
  return {
    key: opts.key,
    tamilTitle: opts.tamilTitle,
    englishTitle: opts.englishTitle,
    description: opts.description,
    category: opts.category ?? 'vocabulary',
    difficulty: opts.difficulty ?? 'easy',
    level: opts.level ?? 'mazhalai',
    sets: [
      { kind: 'quiz', title: `${opts.tamilTitle} -- Quiz`, questions: [...vocabQuiz(opts.words), ...(opts.extraQuiz ?? [])] },
      { kind: 'match', title: `${opts.tamilTitle} -- Word Match`, questions: vocabMatch(opts.words) },
      ...(opts.sortSet ? [{ kind: 'sort' as const, title: opts.sortSet.title, questions: opts.sortSet.questions }] : []),
    ],
  }
}

export const VOCABULARY_TOPICS: BuiltinTopicDef[] = [
  vocabTopic({
    key: 'udal-uruppugal',
    tamilTitle: 'உடல் உறுப்புகள்',
    englishTitle: 'Body Parts',
    description: 'Name the parts of your body in Tamil.',
    words: BODY,
    extraQuiz: [
      mc('நாம் எதனால் பார்க்கிறோம்?', 'கண்', ['காது', 'மூக்கு', 'கை']),
      mc('நாம் எதனால் கேட்கிறோம்?', 'காது', ['கண்', 'வாய்', 'கால்']),
      mc('நாம் எதனால் நடக்கிறோம்?', 'கால்', ['கை', 'தலை', 'பல்']),
    ],
  }),
  vocabTopic({
    key: 'vilangugal',
    tamilTitle: 'விலங்குகள்',
    englishTitle: 'Animals',
    description: 'Farm animals and wild animals in Tamil.',
    words: ANIMALS,
    extraQuiz: [
      mc('நமக்குப் பால் தரும் விலங்கு எது?', 'பசு', ['புலி', 'குரங்கு', 'முயல்']),
      mc('காட்டின் அரசன் என்று அழைக்கப்படும் விலங்கு எது?', 'சிங்கம்', ['யானை', 'மான்', 'நாய்']),
      mc('நீண்ட தும்பிக்கை உள்ள விலங்கு எது?', 'யானை', ['குதிரை', 'கரடி', 'ஆடு']),
    ],
  }),
  vocabTopic({
    key: 'paravaigal',
    tamilTitle: 'பறவைகள்',
    englishTitle: 'Birds',
    description: 'Common birds -- and telling birds apart from animals.',
    words: BIRDS,
    extraQuiz: [
      mc('இந்தியாவின் தேசியப் பறவை எது?', 'மயில்', ['காகம்', 'கிளி', 'புறா']),
      mc('இரவில் விழித்திருக்கும் பறவை எது?', 'ஆந்தை', ['கோழி', 'குருவி', 'வாத்து']),
      mc('பேசக் கற்றுக்கொள்ளும் பச்சை நிறப் பறவை எது?', 'கிளி', ['காகம்', 'கழுகு', 'கொக்கு']),
    ],
    sortSet: {
      title: 'பறவையா விலங்கா? -- Sort',
      questions: [
        sort('பறவையா விலங்கா? வகைப்படுத்துக (Bird or animal?)', {
          பறவை: ['கிளி', 'மயில்', 'காகம்', 'புறா'],
          விலங்கு: ['நாய்', 'யானை', 'பூனை', 'மான்'],
        }),
        sort('பறவையா விலங்கா? வகைப்படுத்துக (Bird or animal?)', {
          பறவை: ['ஆந்தை', 'கழுகு', 'குருவி', 'வாத்து'],
          விலங்கு: ['குதிரை', 'சிங்கம்', 'முயல்', 'கரடி'],
        }),
      ],
    },
  }),
  vocabTopic({
    key: 'pazhangal',
    tamilTitle: 'பழங்கள்',
    englishTitle: 'Fruits',
    description: 'Fruits you know and love, in Tamil.',
    words: FRUITS,
    extraQuiz: [
      mc('"முக்கனிகள்" -- மா, பலா, மற்றும் ___?', 'வாழை', ['கொய்யா', 'திராட்சை', 'ஆப்பிள்'], 'தமிழின் முக்கனிகள்: மா, பலா, வாழை.'),
    ],
    sortSet: {
      title: 'பழமா காய்கறியா? -- Sort',
      questions: [
        sort('பழமா காய்கறியா? வகைப்படுத்துக (Fruit or vegetable?)', {
          பழம்: ['மாம்பழம்', 'வாழைப்பழம்', 'கொய்யா', 'திராட்சை'],
          காய்கறி: ['கத்தரிக்காய்', 'வெண்டைக்காய்', 'உருளைக்கிழங்கு', 'வெங்காயம்'],
        }),
        sort('பழமா காய்கறியா? வகைப்படுத்துக (Fruit or vegetable?)', {
          பழம்: ['அன்னாசி', 'பப்பாளி', 'மாதுளை', 'பலாப்பழம்'],
          காய்கறி: ['கேரட்', 'பாகற்காய்', 'முட்டைக்கோஸ்', 'பூசணிக்காய்'],
        }),
      ],
    },
  }),
  vocabTopic({
    key: 'kaaykarigal',
    tamilTitle: 'காய்கறிகள்',
    englishTitle: 'Vegetables',
    description: 'Vegetables from the market and the kitchen.',
    words: VEGETABLES,
    extraQuiz: [mc('காரமாக இருக்கும் காய் எது?', 'மிளகாய்', ['தக்காளி', 'வெள்ளரிக்காய்', 'பூசணிக்காய்'])],
  }),
  vocabTopic({
    key: 'nirangal',
    tamilTitle: 'நிறங்கள்',
    englishTitle: 'Colors',
    description: 'Colors, and the colors of things around you.',
    words: COLORS,
    extraQuiz: [
      mc('வானத்தின் நிறம் என்ன?', 'நீலம்', ['பச்சை', 'சிவப்பு', 'மஞ்சள்']),
      mc('இலையின் நிறம் என்ன?', 'பச்சை', ['நீலம்', 'வெள்ளை', 'ஊதா']),
      mc('பாலின் நிறம் என்ன?', 'வெள்ளை', ['கருப்பு', 'மஞ்சள்', 'சாம்பல்']),
      mc('காகத்தின் நிறம் என்ன?', 'கருப்பு', ['வெள்ளை', 'பச்சை', 'சிவப்பு']),
    ],
  }),
  vocabTopic({
    key: 'enngal',
    tamilTitle: 'எண்கள்',
    englishTitle: 'Numbers',
    description: 'Counting in Tamil, plus the Tamil numerals ௧ to ௰.',
    words: NUMBERS,
    extraQuiz: [
      mc('மூன்று + இரண்டு = ?', 'ஐந்து', ['நான்கு', 'ஆறு', 'ஏழு']),
      mc('ஆறு + நான்கு = ?', 'பத்து', ['எட்டு', 'ஒன்பது', 'ஏழு']),
      mc('"௫" என்ற தமிழ் எண் எது?', 'ஐந்து', ['மூன்று', 'எட்டு', 'இரண்டு']),
      mc('"௩" என்ற தமிழ் எண் எது?', 'மூன்று', ['ஐந்து', 'ஒன்று', 'ஆறு']),
      mc('"௰" என்ற தமிழ் எண் எது?', 'பத்து', ['நூறு', 'ஒன்று', 'ஒன்பது']),
    ],
  }),
  vocabTopic({
    key: 'kudumbam',
    tamilTitle: 'குடும்பம்',
    englishTitle: 'Family',
    description: 'The people in your family, in Tamil.',
    words: FAMILY,
    category: 'everyday',
    extraQuiz: [
      mc('அப்பாவின் அம்மா யார்?', 'பாட்டி', ['அத்தை', 'அக்கா', 'தங்கை']),
      mc('அப்பாவின் அப்பா யார்?', 'தாத்தா', ['மாமா', 'அண்ணன்', 'தம்பி']),
      mc('அம்மாவின் சகோதரர் யார்?', 'மாமா', ['தாத்தா', 'அப்பா', 'தம்பி']),
    ],
  }),
  vocabTopic({
    key: 'palli',
    tamilTitle: 'பள்ளி',
    englishTitle: 'School',
    description: 'Things and people you find at school.',
    words: SCHOOL,
    category: 'everyday',
    extraQuiz: [
      mc('நாம் எதைக் கொண்டு எழுதுகிறோம்?', 'பேனா', ['மேசை', 'பை', 'நாற்காலி']),
      mc('புத்தகங்கள் நிறைந்த இடம் எது?', 'நூலகம்', ['வகுப்பறை', 'கரும்பலகை', 'மேசை']),
    ],
  }),
  vocabTopic({
    key: 'veedu',
    tamilTitle: 'வீடு',
    englishTitle: 'Home',
    description: 'Rooms and things around the house.',
    words: HOME,
    category: 'everyday',
    extraQuiz: [
      mc('வீட்டில் சமைக்கும் அறை எது?', 'சமையலறை', ['படுக்கையறை', 'கூரை', 'சன்னல்']),
      mc('நேரம் பார்க்க உதவுவது எது?', 'கடிகாரம்', ['விளக்கு', 'கதவு', 'சுவர்']),
    ],
  }),
  vocabTopic({
    key: 'unavu',
    tamilTitle: 'உணவு',
    englishTitle: 'Food',
    description: 'Everyday Tamil food and drinks.',
    words: FOOD,
    category: 'everyday',
    extraQuiz: [
      mc('தேனீக்கள் தருவது எது?', 'தேன்', ['பால்', 'உப்பு', 'தயிர்']),
      mc('இனிப்புச் சுவை தருவது எது?', 'சர்க்கரை', ['உப்பு', 'தண்ணீர்', 'சாம்பார்']),
    ],
  }),
  vocabTopic({
    key: 'iyarkai',
    tamilTitle: 'இயற்கை',
    englishTitle: 'Nature',
    description: 'The sky, land and water around us.',
    words: NATURE,
    extraQuiz: [
      mc('பகலில் ஒளி தருவது எது?', 'சூரியன்', ['நிலா', 'மேகம்', 'கடல்']),
      mc('மழை எங்கிருந்து பெய்கிறது?', 'மேகம்', ['மலை', 'மரம்', 'நதி']),
    ],
  }),
  vocabTopic({
    key: 'thozhilgal',
    tamilTitle: 'தொழில்கள்',
    englishTitle: 'Occupations',
    description: 'The jobs people do, and what each one does.',
    words: JOBS,
    category: 'everyday',
    difficulty: 'medium',
    level: 'grade-1',
    extraQuiz: [
      mc('நோயாளிகளுக்கு மருத்துவம் பார்ப்பவர் யார்?', 'மருத்துவர்', ['விவசாயி', 'தச்சர்', 'மீனவர்']),
      mc('வயலில் பயிர் செய்பவர் யார்?', 'விவசாயி', ['காவலர்', 'ஓட்டுநர்', 'தையல்காரர்']),
      mc('துணி தைப்பவர் யார்?', 'தையல்காரர்', ['சமையல்காரர்', 'பொறியாளர்', 'வணிகர்']),
      mc('கடலில் மீன் பிடிப்பவர் யார்?', 'மீனவர்', ['மருத்துவர்', 'ஆசிரியர்', 'செவிலியர்']),
      mc('மரத்தால் கதவு, நாற்காலி செய்பவர் யார்?', 'தச்சர்', ['ஓட்டுநர்', 'காவலர்', 'விவசாயி']),
    ],
  }),
  vocabTopic({
    key: 'pokkuvarathu',
    tamilTitle: 'போக்குவரத்து',
    englishTitle: 'Transport',
    description: 'Ways to travel on land, water and in the air.',
    words: TRANSPORT,
    category: 'everyday',
    difficulty: 'medium',
    level: 'grade-1',
    extraQuiz: [
      mc('வானில் பறக்கும் வாகனம் எது?', 'விமானம்', ['கப்பல்', 'பேருந்து', 'மிதிவண்டி']),
      mc('கடலில் செல்லும் பெரிய வாகனம் எது?', 'கப்பல்', ['விமானம்', 'மகிழுந்து', 'மாட்டுவண்டி']),
      mc('தண்டவாளத்தில் ஓடும் வாகனம் எது?', 'தொடர்வண்டி', ['படகு', 'சரக்குந்து', 'மிதிவண்டி']),
    ],
  }),
]
