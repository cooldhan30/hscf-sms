// The achievement catalog -- code, not a database table, for the same
// reason lib/gameRoomV2/registry.ts's engines are code: these are
// versioned-with-the-app definitions (id, name, teacher-facing
// description, icon, category), not admin-editable content. Only which
// achievements a STUDENT has actually earned is persisted (see
// sms_gamev2_player_achievements, migration 077).
//
// Every description is written so a TEACHER reading a student's
// earned-achievements list understands exactly what the student
// demonstrated -- per the request's explicit "design achievements so
// teachers can understand what students accomplished" requirement.
// None of these reference twitch/speed; every one reflects either
// consistent practice, accuracy, or breadth of engagement across
// engines and content.
export type AchievementCategory = 'milestone' | 'mastery' | 'consistency' | 'accuracy' | 'engine'

export interface AchievementDefinition {
  id: string
  name: string
  tamilName: string | null
  // What a TEACHER should understand this achievement means -- written
  // in plain, evaluative language ("completed", "answered", "played"),
  // never game-internal jargon (no "cleared wave 6" or "defeated Suran").
  teacherDescription: string
  // What the STUDENT sees -- can be a little more celebratory in tone.
  studentDescription: string
  icon: string
  category: AchievementCategory
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-game',
    name: 'First Game',
    tamilName: 'முதல் விளையாட்டு',
    teacherDescription: 'Completed their first GameRoom session.',
    studentDescription: 'You played your first game!',
    icon: '\u{1F3AE}',
    category: 'milestone',
  },
  {
    id: 'ten-games',
    name: '10 Games Completed',
    tamilName: 'பத்து விளையாட்டுகள்',
    teacherDescription: 'Completed 10 GameRoom sessions.',
    studentDescription: "You've completed 10 games!",
    icon: '\u{1F3C5}',
    category: 'milestone',
  },
  {
    id: 'fifty-games',
    name: '50 Games Completed',
    tamilName: 'ஐம்பது விளையாட்டுகள்',
    teacherDescription: 'Completed 50 GameRoom sessions -- sustained, regular practice.',
    studentDescription: "50 games played -- you're a GameRoom regular!",
    icon: '\u{1F396}️',
    category: 'milestone',
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    tamilName: 'முழுமையான மதிப்பெண்',
    teacherDescription: 'Answered every question correctly in a single session.',
    studentDescription: 'Perfect round -- every answer correct!',
    icon: '\u{1F3AF}',
    category: 'accuracy',
  },
  {
    id: 'hundred-correct',
    name: '100 Correct Answers',
    tamilName: 'நூறு சரியான பதில்கள்',
    teacherDescription: 'Answered 100 questions correctly across all sessions.',
    studentDescription: "100 correct answers -- that's real knowledge!",
    icon: '\u{1F4AF}',
    category: 'accuracy',
  },
  {
    id: 'five-hundred-correct',
    name: '500 Correct Answers',
    tamilName: 'ஐந்நூறு சரியான பதில்கள்',
    teacherDescription: 'Answered 500 questions correctly across all sessions.',
    studentDescription: '500 correct answers -- outstanding consistency!',
    icon: '\u{1F31F}',
    category: 'accuracy',
  },
  {
    id: 'three-day-streak',
    name: '3-Day Practice Streak',
    tamilName: 'மூன்று நாள் பயிற்சி',
    teacherDescription: 'Played GameRoom on 3 consecutive days.',
    studentDescription: "3 days in a row -- you're building a habit!",
    icon: '\u{1F525}',
    category: 'consistency',
  },
  {
    id: 'seven-day-streak',
    name: '7-Day Practice Streak',
    tamilName: 'ஏழு நாள் பயிற்சி',
    teacherDescription: 'Played GameRoom on 7 consecutive days.',
    studentDescription: 'A full week of daily practice!',
    icon: '\u{1F4C5}',
    category: 'consistency',
  },
  {
    id: 'thirty-day-streak',
    name: '30-Day Practice Streak',
    tamilName: 'முப்பது நாள் பயிற்சி',
    teacherDescription: 'Played GameRoom on 30 consecutive days -- exceptional consistency.',
    studentDescription: 'A whole month, every day. Incredible discipline!',
    icon: '\u{1F3C6}',
    category: 'consistency',
  },
  {
    id: 'grammar-explorer',
    name: 'Grammar Explorer',
    tamilName: 'இலக்கண ஆய்வாளர்',
    teacherDescription: 'Completed a Word Ninja session, practicing Tamil grammar categorization.',
    studentDescription: 'You explored Tamil grammar with Word Ninja!',
    icon: '\u{1FA84}',
    category: 'engine',
  },
  {
    id: 'word-master',
    name: 'Word Master',
    tamilName: 'சொல் வல்லுநர்',
    teacherDescription: 'Answered every word in a Word Ninja round correctly on the first attempt.',
    studentDescription: 'Every word, every lane, correct!',
    icon: '\u{1F4DA}',
    category: 'mastery',
  },
  {
    id: 'tower-defender',
    name: 'Tower Defender',
    tamilName: 'கோபுர காவலர்',
    teacherDescription: 'Successfully defended the fort through every wave in Tower Defense.',
    studentDescription: 'You defended the fort to the very last wave!',
    icon: '\u{1F3F0}',
    category: 'engine',
  },
  {
    id: 'boss-slayer',
    name: 'Boss Slayer',
    tamilName: 'அரக்கன் வீழ்த்தி',
    teacherDescription: 'Defeated a boss through every phase in Boss Battle.',
    studentDescription: 'Victory! You brought down the boss.',
    icon: '\u{2694}️',
    category: 'engine',
  },
  {
    id: 'treasure-hunter',
    name: 'Treasure Hunter',
    tamilName: 'கருவூல வேட்டைக்காரர்',
    teacherDescription: 'Reached the treasury in Treasure Quest.',
    studentDescription: 'You found the treasure!',
    icon: '\u{1F4B0}',
    category: 'engine',
  },
  {
    id: 'checkered-flag',
    name: 'Checkered Flag',
    tamilName: 'வெற்றிக் கொடி',
    teacherDescription: 'Won a race in the Racing engine on accuracy alone.',
    studentDescription: "You crossed the finish line first!",
    icon: '\u{1F3C1}',
    category: 'engine',
  },
  {
    id: 'well-rounded',
    name: 'Well-Rounded Player',
    tamilName: 'பன்முக வீரர்',
    teacherDescription: 'Played every available GameRoom game engine at least once.',
    studentDescription: "You've tried every game in GameRoom!",
    icon: '\u{1F9E9}',
    category: 'mastery',
  },
  {
    id: 'set-champion',
    name: 'Question Set Champion',
    tamilName: 'வினாத்தொகுப்பு வீரர்',
    teacherDescription: 'Fully completed the same Question Set 3 separate times, showing repeated review.',
    studentDescription: "You've mastered this question set through repeated practice!",
    icon: '\u{1F4D6}',
    category: 'mastery',
  },
]

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
