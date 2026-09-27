// Power-ups a correct Tamil answer earns in Tamil Grand Prix. They are
// held (up to POWER_SLOTS) and the PLAYER decides when to fire them, so a
// correct answer is an opportunity, never an automatic win: a boost fired
// into a bend or a shield saved for nothing is wasted.
//
// Simulation-only: power-ups never affect XP, coins, analytics or any
// persisted result -- those come only from the server-graded answers.

export type PowerId = 'boost' | 'shield' | 'burst' | 'magnet' | 'grip' | 'repair' | 'star'

export interface PowerDef {
  id: PowerId
  tamilName: string
  name: string
  tamilHint: string
  // Effect length in seconds (0 = instant).
  duration: number
  color: string
}

export const POWER_SLOTS = 2

export const POWERS: Record<PowerId, PowerDef> = {
  boost: { id: 'boost', tamilName: 'உந்துதல்', name: 'Boost', tamilHint: '3 நொடி உச்ச வேகம் கூடும்', duration: 3, color: '#f97316' },
  shield: { id: 'shield', tamilName: 'கேடயம்', name: 'Shield', tamilHint: 'மோதலும் புல்வெளியும் வேகத்தைக் குறைக்காது', duration: 8, color: '#38bdf8' },
  burst: { id: 'burst', tamilName: 'விரைவுப் பாய்ச்சல்', name: 'Speed burst', tamilHint: 'உடனடி வேகப் பாய்ச்சல்', duration: 0, color: '#facc15' },
  magnet: { id: 'magnet', tamilName: 'நாணய ஈர்ப்பு', name: 'Coin magnet', tamilHint: 'அருகிலுள்ள நாணயங்களை ஈர்க்கும்', duration: 10, color: '#eab308' },
  grip: { id: 'grip', tamilName: 'பிடிப்பு', name: 'Grip', tamilHint: 'வளைவுகளில் சிறந்த கட்டுப்பாடு', duration: 10, color: '#22c55e' },
  repair: { id: 'repair', tamilName: 'மீட்பு', name: 'Recovery', tamilHint: 'சாலைக்குத் திரும்பி வேகம் பெறும்', duration: 0, color: '#a855f7' },
  star: { id: 'star', tamilName: 'தமிழ் நட்சத்திரம்', name: 'Tamil star', tamilHint: 'கேடயமும் உந்துதலும் ஒன்றாக', duration: 4, color: '#ec4899' },
}

export interface AwardContext {
  // Player's place (1 = leading) and number of racers.
  place: number
  racers: number
  // Share of the last lap spent off-road (0..1).
  offroadShare: number
  // Consecutive correct answers including this one.
  streak: number
}

// Picks a useful power-up for the moment: a leader gets defensive tools,
// a player at the back gets speed, a player who keeps leaving the road
// gets handling help, and a 3+ streak earns the special star. `roll` is
// a 0..1 random number (seeded by the caller).
export function awardPower(ctx: AwardContext, roll: number): PowerId {
  if (ctx.streak >= 3 && ctx.streak % 3 === 0) return 'star'
  if (ctx.offroadShare > 0.18) return roll < 0.6 ? 'grip' : 'repair'
  const behind = ctx.racers > 1 ? (ctx.place - 1) / (ctx.racers - 1) : 0
  if (behind >= 0.66) return roll < 0.5 ? 'boost' : roll < 0.85 ? 'burst' : 'grip'
  if (behind <= 0.01) return roll < 0.45 ? 'shield' : roll < 0.75 ? 'magnet' : 'boost'
  return roll < 0.4 ? 'boost' : roll < 0.65 ? 'shield' : roll < 0.85 ? 'burst' : 'magnet'
}
