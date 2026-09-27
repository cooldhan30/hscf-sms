'use client'

import { GameMusic, N, hz, chord, line, type MusicMood, type Score } from '@/components/gameRoomV2/gameplay/gameMusic'

// Tower Defense background music: an original score (composed for this
// game, not derived from any existing melody), synthesized live with the
// Web Audio API so it ships zero audio files. Moods:
//
//   prep        -- exploring the map between waves: D dorian plucks, a
//                  soft pad and a light shaker; adventurous, a little
//                  mysterious.
//   battle      -- a wave is on: driving bass, drums and brass stabs over
//                  the Andalusian descent (Dm C Bb A).
//   boss        -- the Irul King: low brass ostinato, four-on-the-floor
//                  drums; `intense` (enraged) adds a tremolo string line
//                  and pushes the tempo.
//   victory / defeat -- one-shot stings (the defeat one resolves to a
//                  hopeful major chord -- this is a learning game).
//
// The engine (scheduler, synth voices, ducking, Music toggle, hidden-tab
// pause, cleanup) is the shared one in gameplay/gameMusic.ts.

export type { MusicMood }

// Harmony.
const PREP_CHORDS = [chord('D2', 'D4', 'F4', 'A4', 'E5'), chord('Bb1', 'D4', 'F4', 'Bb4', 'C5'), chord('F2', 'C4', 'F4', 'A4', 'G5'), chord('C2', 'C4', 'E4', 'G4', 'D5')]
const BATTLE_CHORDS = [chord('D2', 'D4', 'F4', 'A4'), chord('C2', 'C4', 'E4', 'G4'), chord('Bb1', 'Bb3', 'D4', 'F4'), chord('A1', 'A3', 'C#4', 'E4')]
const BOSS_CHORDS = [chord('D2', 'D4', 'F4', 'A4'), chord('Eb2', 'Eb4', 'G4', 'Bb4'), chord('D2', 'D4', 'F4', 'A4'), chord('C#2', 'C#4', 'E4', 'G4')]

// Melodies: one entry per 16th step over 8 bars (128 steps); null = rest,
// a note name starts a note held until the next entry.
// Prep: a questing theme -- rises, looks around, settles.
const PREP_MELODY = line([
  'D5 - - - . . A4 - D5 - E5 - F5 - - -',
  'E5 - - - D5 - - - . . . . . . . .',
  'C5 - - - . . G4 - C5 - D5 - E5 - - -',
  'G5 - - - F5 - E5 - C5 - - - . . . .',
  'A4 - - - . . F4 - A4 - C5 - D5 - - -',
  'E5 - F5 - E5 - C5 - A4 - - - . . . .',
  'G4 - A4 - C5 - - - E5 - D5 - C5 - - -',
  'D5 - - - - - - - . . . . . . . .',
])
// Battle: a heroic call and answer.
const BATTLE_MELODY = line([
  'A4 - - D5 - - F5 - E5 - D5 - A4 - - -',
  'G4 - - C5 - - E5 - D5 - C5 - G4 - - -',
  'F4 - - Bb4 - - D5 - F5 - - - E5 - D5 -',
  'C#5 - - - A4 - - - E5 - - - . . . .',
  'D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -',
  'E5 - - - C5 - - - G5 - - - . . . .',
  'F5 - E5 - D5 - Bb4 - D5 - - - F5 - - -',
  'E5 - - - - - - - C#5 - D5 - E5 - - -',
])
// Boss: a menacing brass ostinato (per bar, 16 steps).
const BOSS_OSTINATO = line(['D2 . D2 . F2 . D2 . Eb2 . D2 . C2 . D2 .'])
const BOSS_HOOK = line([
  'D5 - - - Eb5 - - - D5 - C#5 - D5 - - -',
  '. . . . . . . . . . . . . . . .',
  'F5 - - - G5 - - - F5 - Eb5 - D5 - - -',
  '. . . . . . . . A4 - Bb4 - C#5 - - -',
])

const TD_SCORE: Score = {
  bpm(mood, intense) {
    return mood === 'prep' ? 92 : mood === 'battle' ? 124 : intense ? 146 : 136
  },
  play(m, dest, step, t, sd, mood, intense) {
    const s16 = step % 16
    const bar = Math.floor(step / 16)
    if (mood === 'prep') {
      const ch = PREP_CHORDS[bar % 4]
      if (s16 === 0) {
        m.bass(dest, hz(ch.root), t, sd * 14, 0.12)
        for (const n of ch.tones.slice(0, 3)) m.pad(dest, hz(n), t, sd * 16, 0.02)
      }
      if (s16 === 8) m.bass(dest, hz(ch.root + 7), t, sd * 6, 0.08)
      // Rolling arpeggio on eighths.
      if (s16 % 2 === 0) {
        const order = [0, 1, 2, 3, 2, 1, 3, 2]
        m.pluck(dest, hz(ch.tones[order[(s16 / 2) % 8]]), t, sd * 3, 0.05)
      }
      if (s16 % 4 === 2) m.hat(dest, t, 0.018, 0.05)
      m.melody(dest, PREP_MELODY, step, t, sd, 0.055, 'lead')
    } else if (mood === 'battle') {
      const ch = BATTLE_CHORDS[bar % 4]
      if (s16 % 2 === 0) {
        const oct = s16 % 8 === 6 ? 12 : s16 % 8 === 4 ? 7 : 0
        m.bass(dest, hz(ch.root + oct), t, sd * 1.8, 0.2)
      }
      if (s16 === 0 || s16 === 8 || s16 === 11) m.kick(dest, t, 0.6)
      if (s16 === 4 || s16 === 12) m.snare(dest, t, 0.22)
      if (s16 % 2 === 0) m.hat(dest, t, s16 % 4 === 2 ? 0.05 : 0.03, 0.04)
      if (bar % 4 === 3 && s16 >= 12) m.tom(dest, t, 180 - (s16 - 12) * 25, 0.3)
      if (s16 === 0 || s16 === 3 || s16 === 6) for (const n of ch.tones) m.brass(dest, hz(n), t, sd * (s16 === 6 ? 6 : 2), 0.035)
      m.melody(dest, BATTLE_MELODY, step, t, sd, 0.06, 'lead')
    } else if (mood === 'boss') {
      const ch = BOSS_CHORDS[bar % 4]
      const ost = BOSS_OSTINATO[s16]
      if (ost !== null && ost > 0) m.brass(dest, hz(ost + (ch.root - N['D2'])), t, sd * 1.6, 0.14, 700)
      if (s16 % 4 === 0) m.kick(dest, t, 0.75)
      if (s16 === 4 || s16 === 12) m.snare(dest, t, 0.26)
      m.hat(dest, t, intense || s16 % 2 === 0 ? 0.035 : 0, 0.03)
      if (s16 === 0) for (const n of ch.tones) m.pad(dest, hz(n), t, sd * 16, 0.03)
      m.melody(dest, BOSS_HOOK, step, t, sd, 0.06, 'brass')
      if (intense && s16 % 2 === 0) m.pluck(dest, hz(ch.tones[(s16 / 2) % ch.tones.length] + 12), t, sd * 1.5, 0.035)
    }
  },
  sting(m, g, kind, t) {
    if (kind === 'victory') {
      // Fanfare: D major, rising triplet then a held chord with a cymbal swell.
      const brassNotes: [string, number, number][] = [
        ['D4', 0, 0.16], ['F#4', 0.16, 0.16], ['A4', 0.32, 0.16],
        ['D5', 0.5, 0.35], ['A4', 0.86, 0.14], ['D5', 1.0, 0.14], ['F#5', 1.14, 1.6],
      ]
      for (const [n, at, dur] of brassNotes) m.brass(g, hz(N[n]), t + at, dur, 0.16)
      for (const n of ['D3', 'A3', 'D4', 'F#4', 'A4']) m.pad(g, hz(N[n]), t + 1.1, 2.2, 0.05)
      m.bass(g, hz(N['D2']), t + 1.1, 1.8, 0.3)
      for (const at of [0, 0.5, 1.1]) m.kick(g, t + at, 0.7)
      m.cymbal(g, t + 1.1, 1.8)
      return 3.2
    } else {
      // Gentle fall, then a warm "try again" resolution.
      const pl: [string, number][] = [['A4', 0], ['F4', 0.3], ['D4', 0.6], ['C#4', 0.9]]
      for (const [n, at] of pl) m.pluck(g, hz(N[n]), t + at, 0.6, 0.14)
      for (const n of ['Bb3', 'D4', 'F4']) m.pad(g, hz(N[n]), t + 1.3, 1.1, 0.05)
      for (const n of ['F3', 'A3', 'C4', 'F4']) m.pad(g, hz(N[n]), t + 2.3, 1.8, 0.05)
      m.bass(g, hz(N['Bb1']), t + 1.3, 1.0, 0.22)
      m.bass(g, hz(N['F2']), t + 2.3, 1.6, 0.22)
      m.pluck(g, hz(N['A4']), t + 2.3, 1.2, 0.1)
      m.pluck(g, hz(N['C5']), t + 2.5, 1.2, 0.08)
      return 4
    }
  },
}

export class TdMusic extends GameMusic {
  constructor() {
    super(TD_SCORE)
  }
}
