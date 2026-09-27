// GameRoom's shared correct-answer celebration: WHAT to celebrate and how
// strongly. Pure and framework-free (verified by
// scripts/verify-gameroom-v2-celebration.ts); the canvas layer that draws
// it lives in components/gameRoomV2/celebration/CelebrationLayer.tsx.
//
// Intensity tiers keep the screen readable: an ordinary correct answer is
// a small burst, a streak is bigger, a hard question or milestone is
// stronger still, and only a real victory gets the full-screen confetti.

export type CelebrationTier = 'small' | 'streak' | 'major' | 'victory'

export interface CelebrationInput {
  // The streak AFTER this answer (1 = first correct in a row).
  streak: number
  // A harder-than-usual question (e.g. typed answer, boss checkpoint).
  hard?: boolean
  // A game milestone reached on this answer (wave cleared, lap, catch...).
  milestone?: boolean
  victory?: boolean
}

// Streaks at or above this are celebrated as a streak.
export const STREAK_TIER_AT = 3
// Streak lengths that count as a milestone on their own.
export const STREAK_MILESTONES = [5, 10, 15, 20, 30, 50] as const

export function tierFor(input: CelebrationInput): CelebrationTier {
  if (input.victory) return 'victory'
  if (input.hard || input.milestone || (STREAK_MILESTONES as readonly number[]).includes(input.streak)) return 'major'
  if (input.streak >= STREAK_TIER_AT) return 'streak'
  return 'small'
}

export interface TierSpec {
  // Spark/star particles from the burst origin.
  sparks: number
  // Confetti pieces (0 = none). Full-screen confetti is victory-only.
  confetti: number
  // How long the "சரி!" card stays up.
  cardMs: number
  // A gentle screen pulse (never a shake -- shake reads as "hurt").
  pulse: boolean
  // Sound layering, in order (see components/gameRoomV2/gameplay/playSound.ts).
  sounds: ('correct' | 'streak' | 'achievement' | 'victory' | 'coin')[]
  haptic: 'correct' | 'streak' | 'achievement' | 'victory'
}

export const TIER_SPEC: Record<CelebrationTier, TierSpec> = {
  small: { sparks: 18, confetti: 0, cardMs: 1300, pulse: false, sounds: ['correct'], haptic: 'correct' },
  streak: { sparks: 34, confetti: 24, cardMs: 1600, pulse: false, sounds: ['correct', 'streak'], haptic: 'streak' },
  major: { sparks: 56, confetti: 60, cardMs: 1900, pulse: true, sounds: ['correct', 'achievement'], haptic: 'achievement' },
  victory: { sparks: 80, confetti: 170, cardMs: 2600, pulse: true, sounds: ['victory'], haptic: 'victory' },
}

// Hard ceiling on live particles across every burst on screen, so rapid
// answers (or a victory right after a streak) can never flood a phone.
export const MAX_PARTICLES = 260

export type RewardKind = 'coins' | 'xp' | 'scroll' | 'boost' | 'shield' | 'heal' | 'power' | 'bait' | 'points'

export interface Reward {
  kind: RewardKind
  amount?: number
  // Overrides the default Tamil label (e.g. a named power-up).
  label?: string
}

export const REWARD_LABEL: Record<RewardKind, { ta: string; en: string }> = {
  coins: { ta: 'நாணயங்கள்', en: 'coins' },
  xp: { ta: 'அனுபவப் புள்ளிகள்', en: 'XP' },
  scroll: { ta: 'சுவடி', en: 'scroll' },
  boost: { ta: 'உந்துதல்', en: 'boost' },
  shield: { ta: 'கேடயம்', en: 'shield' },
  heal: { ta: 'உயிராற்றல்', en: 'health' },
  power: { ta: 'ஆற்றல்', en: 'power-up' },
  bait: { ta: 'தூண்டில் இரை', en: 'bait' },
  points: { ta: 'புள்ளிகள்', en: 'points' },
}

export function rewardText(r: Reward): string {
  const label = r.label ?? REWARD_LABEL[r.kind].ta
  return r.amount !== undefined ? `+${r.amount} ${label}` : `+ ${label}`
}

// Short, warm, age-appropriate praise; rotates so it never feels canned.
// Picked deterministically from the streak so tests are stable.
export const PRAISE: Record<CelebrationTier, string[]> = {
  small: ['சரி!', 'சரியான விடை!', 'நன்று!'],
  streak: ['அருமை!', 'அசத்தல்!', 'தொடர்ந்து வெல்கிறீர்கள்!'],
  major: ['அற்புதம்!', 'மிகச் சிறப்பு!', 'சாதனை!'],
  victory: ['வெற்றி!'],
}

export function praiseFor(tier: CelebrationTier, streak: number): string {
  const list = PRAISE[tier]
  return list[Math.abs(streak) % list.length]
}

// Wrong answers: never shaming. A calm heading, the facts, and a nudge.
export const ENCOURAGEMENT = [
  { ta: 'பரவாயில்லை -- அடுத்த முறை நிச்சயம்!', en: "No problem -- you'll get the next one!" },
  { ta: 'தவறிலிருந்துதான் கற்றுக்கொள்கிறோம்.', en: 'Mistakes are how we learn.' },
  { ta: 'விடையைப் பாருங்கள், தொடர்ந்து முயலுங்கள்!', en: 'Check the answer and keep going!' },
  { ta: 'ஒவ்வொரு முயற்சியும் உங்களை வலிமையாக்கும்.', en: 'Every try makes you stronger.' },
] as const

export function encouragementFor(seed: number) {
  return ENCOURAGEMENT[Math.abs(seed) % ENCOURAGEMENT.length]
}
