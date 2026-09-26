// Scripted Tower Defense player used for balance checks
// (scripts/verify-gameroom-v2-tower-defense.ts) and tuning experiments.
import {
  createTd,
  placeTower,
  upgradeTower,
  startWave,
  step,
  grantAnswerReward,
  activateAbility,
  abilityReady,
  planRun,
  pathLength,
  positionAt,
  upgradeCost,
  getTowerType,
  mulberry32,
  type TdState,
  type TowerTypeId,
} from '../lib/gameRoomV2/towerDefense'

// A simple but sensible player: answers questions with the given accuracy,
// builds a mix of towers near the middle of the path, upgrades, and uses
// abilities when things get dangerous.
export function playRun(seed: number, difficulty: 'easy' | 'normal' | 'hard', accuracy: number, skill: 'good' | 'idle'): TdState {
  const questions = 15
  const plan = planRun(questions)
  const s = createTd({ seed, difficulty, totalWaves: plan.totalWaves })
  const rand = mulberry32(seed ^ 0xabc)
  const total = pathLength(s.map.path)
  // Pads ranked by how much path they cover.
  const coverage = (pad: { x: number; y: number }) => {
    let c = 0
    for (let d = 0; d <= total; d += 0.25) {
      const p = positionAt(s.map.path, d)
      if (Math.hypot(p.x - pad.x, p.y - pad.y) <= 2.4) c++
    }
    return c
  }
  const pads = [...s.map.pads].sort((a, b) => coverage(b) - coverage(a))
  const order: TowerTypeId[] = ['vel', 'yanai', 'vel', 'pani', 'kuri', 'yanai', 'kuri', 'vel', 'pani', 'kuri', 'yanai', 'vel']
  for (let w = 0; w < plan.totalWaves; w++) {
    for (let q = 0; q < plan.questionsBeforeWave[w]; q++) {
      const correct = rand() < accuracy
      grantAnswerReward(s, { correct, points: correct ? 1000 + Math.floor(rand() * 500) : 0 })
    }
    if (skill === 'good') {
      let spent = true
      while (spent) {
        spent = false
        const next = s.towers.length < pads.length ? order[s.towers.length % order.length] : null
        const cheapestUpgrade = s.towers
          .filter((t) => upgradeCost(t.type, t.level) !== null)
          .sort((a, b) => upgradeCost(a.type, a.level)! - upgradeCost(b.type, b.level)!)[0]
        if (next && s.towers.length < 6 && s.coins >= getTowerType(next).cost) {
          spent = placeTower(s, pads[s.towers.length].id, next).ok
        } else if (cheapestUpgrade && s.coins >= upgradeCost(cheapestUpgrade.type, cheapestUpgrade.level)!) {
          spent = upgradeTower(s, cheapestUpgrade.id).ok
        } else if (next && s.coins >= getTowerType(next).cost) {
          spent = placeTower(s, pads[s.towers.length].id, next).ok
        }
      }
    }
    startWave(s)
    while (s.phase === 'wave') {
      step(s)
      if (skill === 'good') {
        const boss = s.enemies.find((e) => e.isBoss)
        if (boss && abilityReady(s, 'strike')) activateAbility(s, 'strike', { x: boss.x, y: boss.y })
        if (s.enemies.some((e) => e.dist > total * 0.8) && abilityReady(s, 'freeze')) activateAbility(s, 'freeze', null)
        if (boss && abilityReady(s, 'rally')) activateAbility(s, 'rally', null)
        if (s.baseHp <= s.maxBaseHp - 6 && abilityReady(s, 'repair')) activateAbility(s, 'repair', null)
      }
    }
    if (s.phase === 'defeat') break
  }
  return s
}

export const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 37)
export function winRate(difficulty: 'easy' | 'normal' | 'hard', accuracy: number, skill: 'good' | 'idle') {
  const runs = SEEDS.map((seed) => playRun(seed, difficulty, accuracy, skill))
  const wins = runs.filter((r) => r.phase === 'victory').length
  const avgWave = runs.reduce((n, r) => n + (r.phase === 'victory' ? r.totalWaves : r.wave), 0) / runs.length
  return { rate: wins / runs.length, avgWave }
}
