// Topics in teaching order, grouped into sections, instead of Tamil
// alphabetical order (which scatters, for example, the eight வேற்றுமை
// topics: முதல், இரண்டாம் ... start with different letters). A topic joins
// a section by its name, so new topics land in the right place too:
//   1. Letters            எழுத்து, குறில் / நெடில், வல்லினம் ...
//   2. Grammar categories  திணை, பால், எண், இடம், காலம்
//   3. Parts of speech     பெயர்ச்சொல் ..., வினைச்சொல் ..., எச்சம் ...
//   4. Cases               ... வேற்றுமை, in order முதல் to எட்டாம்
//   5. Other topics        alphabetical
// Within a section, topics follow the order listed here, then any others
// alphabetically.

export interface TopicSection {
  id: string
  title: string
}

export const TOPIC_SECTIONS: TopicSection[] = [
  { id: 'letters', title: 'எழுத்துகள் · Letters' },
  { id: 'grammar', title: 'திணை · பால் · எண் · இடம் · காலம்' },
  { id: 'words', title: 'சொல் வகைகள் · Parts of speech' },
  { id: 'cases', title: 'வேற்றுமை உருபுகள் · Cases' },
  { id: 'other', title: 'Other topics' },
]

const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()

const LETTERS = ['உயிர் எழுத்துக்கள்', 'மெய் எழுத்துக்கள்', 'உயிர்மெய் எழுத்துக்கள்', 'குறில் / நெடில்', 'குறில் நெடில் – எழுத்துக்கள்', 'குறில் நெடில் – சொற்களில்', 'வல்லினம் / மெல்லினம் / இடையினம்', 'வல்லினம்', 'மெல்லினம்', 'இடையினம்', 'இன எழுத்துக்கள்']
const GRAMMAR = ['திணை', 'பால்', 'எண்', 'இடம்', 'காலம்']
const WORDS = ['பெயர்ச்சொல்', 'பெயர்ச்சொல் – கண்டறிதல்', 'பெயர்ச்சொல் வகைகள்', 'வினைச்சொல்', 'வினைச்சொல் – கண்டறிதல்', 'வினைமுற்று', 'பெயரெச்சம்', 'வினையெச்சம்', 'எச்சம் – பெயரெச்சம் / வினையெச்சம்', 'வினையெச்சம் / வினைமுற்று']
// The eight cases, by the ordinal their names start with.
const CASE_ORDINALS = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்', 'ஐந்தாம்', 'ஆறாம்', 'ஏழாம்', 'எட்டாம்']

const LETTER_WORDS = /எழுத்து|குறில்|நெடில்|வல்லின|மெல்லின|இடையின/
const SPEECH_WORDS = /பெயர்ச்சொல்|வினைச்சொல்|எச்சம்|வினைமுற்று/

// Where a topic goes: its section, and its place within that section.
export function topicPlace(name: string): { section: string; rank: number } {
  const n = norm(name)
  const listed = (list: string[]) => list.indexOf(n)
  if (n.includes('வேற்றுமை')) {
    const i = CASE_ORDINALS.findIndex((o) => n.startsWith(o))
    return { section: 'cases', rank: i === -1 ? 100 : i }
  }
  if (GRAMMAR.includes(n)) return { section: 'grammar', rank: listed(GRAMMAR) }
  if (LETTERS.includes(n) || LETTER_WORDS.test(n)) return { section: 'letters', rank: LETTERS.includes(n) ? listed(LETTERS) : 100 }
  if (WORDS.includes(n) || SPEECH_WORDS.test(n)) return { section: 'words', rank: WORDS.includes(n) ? listed(WORDS) : 100 }
  return { section: 'other', rank: 100 }
}

const SECTION_INDEX = new Map(TOPIC_SECTIONS.map((s, i) => [s.id, i]))

// Sort comparator: section, then place in section, then name.
export function compareTopics(a: string, b: string): number {
  const pa = topicPlace(a)
  const pb = topicPlace(b)
  return SECTION_INDEX.get(pa.section)! - SECTION_INDEX.get(pb.section)! || pa.rank - pb.rank || a.localeCompare(b, 'ta')
}

// Items grouped into the sections above (empty sections left out), each
// sorted. `last` items (e.g. questions without a topic) go at the very end.
export function groupTopics<T>(items: T[], nameOf: (item: T) => string, last: (item: T) => boolean = () => false): { section: TopicSection; items: T[] }[] {
  const sorted = items.slice().sort((x, y) => Number(last(x)) - Number(last(y)) || compareTopics(nameOf(x), nameOf(y)))
  return TOPIC_SECTIONS.map((section) => ({ section, items: sorted.filter((t) => (last(t) ? section.id === 'other' : topicPlace(nameOf(t)).section === section.id)) })).filter((g) => g.items.length > 0)
}
