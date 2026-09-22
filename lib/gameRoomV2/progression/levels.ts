// The XP -> Level curve, shared across every GameRoom V2 engine. This
// belongs to the platform, not any individual game -- exactly the
// request's framing ("this system belongs to GameRoom, not individual
// games"). A student's level is always derived from total_xp, never
// stored redundantly, so there is nothing to keep in sync if the curve
// itself is ever retuned.
//
// Curve: level N requires N * 100 XP more than level N-1 (a simple
// increasing-cost curve: level 2 at 100 XP, level 3 at 300, level 4 at
// 600, ...), which keeps early levels quick (motivating) while later
// levels take meaningfully longer (so a level number stays a genuine
// signal of accumulated practice, not something everyone maxes out in
// a week).
const XP_PER_LEVEL_STEP = 100

// Total XP required to REACH a given level (level 1 requires 0).
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  // Sum of XP_PER_LEVEL_STEP * 2 + XP_PER_LEVEL_STEP * 3 + ... up to level
  // = XP_PER_LEVEL_STEP * (2 + 3 + ... + level)
  // = XP_PER_LEVEL_STEP * (sum(1..level) - 1)
  const sumOneToLevel = (level * (level + 1)) / 2
  return XP_PER_LEVEL_STEP * (sumOneToLevel - 1)
}

export interface LevelProgress {
  level: number
  xpIntoCurrentLevel: number
  xpNeededForNextLevel: number
  totalXp: number
}

// Derives a student's level and in-level progress purely from their
// total_xp -- the ONE place this calculation happens, so a HUD, a
// profile page, and a teacher report all agree by construction.
export function levelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp)
  let level = 1
  while (xpRequiredForLevel(level + 1) <= xp) {
    level++
  }
  const xpAtLevelStart = xpRequiredForLevel(level)
  const xpAtNextLevel = xpRequiredForLevel(level + 1)
  return {
    level,
    xpIntoCurrentLevel: xp - xpAtLevelStart,
    xpNeededForNextLevel: xpAtNextLevel - xpAtLevelStart,
    totalXp: xp,
  }
}
