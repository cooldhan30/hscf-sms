'use client'

import { GameMusic, N, hz, chord, line, type Score } from '@/components/gameRoomV2/gameplay/gameMusic'

// Boss Battle's original score (written for this game, synthesized live
// by the shared engine in gameplay/gameMusic.ts). E minor, so it never
// sounds like Tower Defense's D-minor score:
//
//   prep    -- checkpoints and the arena select: rolling plucks over
//              Em C G D, a soft pad, a searching melody.
//   battle  -- the waves: syncopated bass and a driving beat over the
//              heroic Em G A C (the A major is the bright, brave colour);
//              `intense` (waves 3-4) adds 16th hats and a counter-line.
//   boss    -- the Irul King: an E-phrygian brass ostinato (Em F Em D),
//              four-on-the-floor; `intense` (phase 2) goes faster with a
//              tremolo line.
//   victory / defeat -- stings (defeat ends on a hopeful chord).

const PREP = [chord('E2', 'E4', 'G4', 'B4', 'F#5'), chord('C2', 'C4', 'E4', 'G4', 'B4'), chord('G2', 'D4', 'G4', 'B4', 'D5'), chord('D2', 'D4', 'F#4', 'A4', 'E5')]
const BATTLE = [chord('E2', 'E4', 'G4', 'B4'), chord('G1', 'D4', 'G4', 'B4'), chord('A1', 'C#4', 'E4', 'A4'), chord('C2', 'C4', 'E4', 'G4')]
const BOSS = [chord('E2', 'E4', 'G4', 'B4'), chord('F2', 'F4', 'A4', 'C5'), chord('E2', 'E4', 'G4', 'B4'), chord('D2', 'D4', 'F#4', 'A4')]

const PREP_MELODY = line([
  'B4 - - - . . E5 - F#5 - G5 - - - . .',
  'E5 - - - - - . . . . . . . . . .',
  'D5 - - - . . G5 - A5 - B5 - - - . .',
  'A5 - - - G5 - F#5 - D5 - - - . . . .',
  'B4 - - - . . E5 - G5 - B5 - - - . .',
  'C6 - B5 - G5 - E5 - . . . . . . . .',
  'D5 - - - F#5 - A5 - G5 - F#5 - D5 - - -',
  'E5 - - - - - - - . . . . . . . .',
])
const BATTLE_MELODY = line([
  'E5 - . E5 - . G5 - B5 - - - A5 - G5 -',
  'D5 - . D5 - . G5 - B5 - - - D6 - - -',
  'C#6 - . C#6 - . A5 - E5 - - - A5 - B5 -',
  'C6 - - - B5 - G5 - E5 - - - . . . .',
  'E5 - G5 - B5 - E6 - D6 - B5 - G5 - - -',
  'D5 - G5 - B5 - D6 - E6 - D6 - B5 - - -',
  'C#6 - - - A5 - - - E5 - F#5 - G#5 - A5 -',
  'G5 - - - E5 - - - B4 - - - . . . .',
])
const BOSS_OSTINATO = line(['E2 . E2 G2 . E2 F2 . E2 . E2 G2 . F2 D2 .'])
const BOSS_HOOK = line([
  'E5 - - - F5 - - - E5 - D5 - E5 - - -',
  '. . . . . . . . . . B4 - C5 - D5 -',
  'G5 - - - F5 - - - E5 - F5 - D5 - - -',
  '. . . . . . . . . . B4 - - - . .',
])

const BRAWL_SCORE: Score = {
  bpm(mood, intense) {
    return mood === 'prep' ? 100 : mood === 'battle' ? (intense ? 134 : 128) : intense ? 152 : 140
  },
  play(m, dest, step, t, sd, mood, intense) {
    const s16 = step % 16
    const bar = Math.floor(step / 16)
    if (mood === 'prep') {
      const ch = PREP[bar % 4]
      if (s16 === 0) {
        m.bass(dest, hz(ch.root), t, sd * 12, 0.12)
        for (const n of ch.tones.slice(0, 3)) m.pad(dest, hz(n), t, sd * 16, 0.02)
      }
      if (s16 === 10) m.bass(dest, hz(ch.root + 7), t, sd * 5, 0.08)
      const order = [0, 2, 1, 3, 2, 1, 3, 1]
      if (s16 % 2 === 0) m.pluck(dest, hz(ch.tones[order[(s16 / 2) % 8]] + (s16 === 12 ? 12 : 0)), t, sd * 3, 0.045)
      if (s16 % 4 === 2) m.hat(dest, t, 0.015, 0.04)
      m.melody(dest, PREP_MELODY, step, t, sd, 0.05, 'lead')
    } else if (mood === 'battle') {
      const ch = BATTLE[bar % 4]
      // Syncopated bass: 1, &2, 3, 3a, 4& (tresillo-ish).
      if ([0, 3, 6, 8, 11, 14].includes(s16)) m.bass(dest, hz(ch.root + (s16 === 14 ? 12 : s16 === 11 ? 7 : 0)), t, sd * 1.8, 0.2)
      if (s16 === 0 || s16 === 7 || s16 === 10) m.kick(dest, t, 0.6)
      if (s16 === 4 || s16 === 12) m.snare(dest, t, 0.22)
      if (intense ? true : s16 % 2 === 0) m.hat(dest, t, s16 % 4 === 2 ? 0.05 : 0.028, 0.035)
      if (bar % 8 === 7 && s16 >= 12) m.tom(dest, t, 200 - (s16 - 12) * 28, 0.3)
      if (s16 === 0 || s16 === 10) for (const n of ch.tones) m.brass(dest, hz(n), t, sd * (s16 === 10 ? 5 : 3), 0.032)
      m.melody(dest, BATTLE_MELODY, step, t, sd, 0.055, 'lead')
      if (intense && s16 % 4 === 2) m.pluck(dest, hz(ch.tones[(bar + s16 / 2) % ch.tones.length] + 12), t, sd * 2, 0.03)
    } else if (mood === 'boss') {
      const ch = BOSS[bar % 4]
      const ost = BOSS_OSTINATO[s16]
      if (ost !== null && ost > 0) m.brass(dest, hz(ost + (ch.root - N['E2'])), t, sd * 1.5, 0.13, 750)
      if (s16 % 4 === 0) m.kick(dest, t, 0.75)
      if (s16 === 4 || s16 === 12) m.snare(dest, t, 0.26)
      if (intense && s16 === 14) m.snare(dest, t, 0.14)
      m.hat(dest, t, intense || s16 % 2 === 0 ? 0.035 : 0, 0.03)
      if (s16 === 0) for (const n of ch.tones) m.pad(dest, hz(n), t, sd * 16, 0.028)
      m.melody(dest, BOSS_HOOK, step, t, sd, 0.06, 'brass')
      if (intense) m.pluck(dest, hz(ch.tones[s16 % ch.tones.length] + 12), t, sd * 0.9, 0.028)
    }
  },
  sting(m, g, kind, t) {
    if (kind === 'victory') {
      // E major fanfare: a call, an answer, a held chord with cymbal.
      const notes: [string, number, number][] = [
        ['B4', 0, 0.14], ['E5', 0.15, 0.14], ['G#5', 0.3, 0.3], ['F#5', 0.62, 0.14], ['G#5', 0.78, 0.14], ['B5', 0.94, 1.7],
      ]
      for (const [n, at, dur] of notes) m.brass(g, hz(N[n]), t + at, dur, 0.15)
      for (const n of ['E3', 'B3', 'E4', 'G#4', 'B4']) m.pad(g, hz(N[n]), t + 0.94, 2.3, 0.05)
      m.bass(g, hz(N['E2']), t + 0.94, 2, 0.3)
      for (const at of [0, 0.3, 0.62, 0.94]) m.kick(g, t + at, 0.7)
      m.cymbal(g, t + 0.94, 2)
      return 3.3
    }
    // Defeat: a falling line, then a warm C major -> G major "go again".
    const pl: [string, number][] = [['B4', 0], ['G4', 0.3], ['E4', 0.6], ['Eb4', 0.9]]
    for (const [n, at] of pl) m.pluck(g, hz(N[n]), t + at, 0.6, 0.13)
    for (const n of ['C4', 'E4', 'G4']) m.pad(g, hz(N[n]), t + 1.3, 1.1, 0.05)
    for (const n of ['G3', 'B3', 'D4', 'G4']) m.pad(g, hz(N[n]), t + 2.3, 1.8, 0.05)
    m.bass(g, hz(N['C2']), t + 1.3, 1, 0.22)
    m.bass(g, hz(N['G2']), t + 2.3, 1.6, 0.22)
    m.pluck(g, hz(N['B4']), t + 2.3, 1.2, 0.1)
    m.pluck(g, hz(N['D5']), t + 2.5, 1.2, 0.08)
    return 4
  },
}

export class BrawlMusic extends GameMusic {
  constructor() {
    super(BRAWL_SCORE)
  }
}
