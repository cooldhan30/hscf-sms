'use client'

import { GameMusic, N, hz, chord, line, type Chord, type Score } from '@/components/gameRoomV2/gameplay/gameMusic'
import { getAudioContext } from '@/components/gameRoomV2/gameplay/playSound'
import type { Ambience, MusicStyle } from '@/lib/gameRoomV2/racing3d'

// Tamil Grand Prix music: an ORIGINAL score per track style, synthesized
// live by the shared engine (gameplay/gameMusic.ts). Moods:
//   prep   -- the starting grid / checkpoint questions (calmer)
//   battle -- racing
//   boss   -- the FINAL LAP (faster, fuller)
//   stings -- victory / defeat
// Each style has its own key, groove and lead voice so the six tracks
// never sound alike. Plus a quiet procedural AMBIENCE bed per track.

interface Style {
  bpm: [number, number, number] // prep, race, final lap
  chords: Chord[]
  prepChords: Chord[]
  melody: (number | null)[]
  lead: 'lead' | 'brass'
  groove: 'four' | 'funk' | 'offbeat' | 'tabla' | 'arp' | 'soft'
}

const STYLES: Record<MusicStyle, Style> = {
  // Chennai streets: funky D minor, slap-ish bass, brass stabs.
  city: {
    bpm: [96, 126, 138],
    chords: [chord('D2', 'D4', 'F4', 'A4', 'C5'), chord('Bb1', 'D4', 'F4', 'Bb4'), chord('G2', 'D4', 'G4', 'Bb4'), chord('A1', 'C#4', 'E4', 'A4')],
    prepChords: [chord('D2', 'D4', 'F4', 'A4'), chord('G2', 'D4', 'G4', 'Bb4')],
    melody: line([
      'D5 - . F5 - . A5 - C6 - A5 - G5 - F5 -',
      'F5 - - - D5 - - - Bb4 - C5 - D5 - . .',
      'G5 - . Bb5 - . D6 - C6 - Bb5 - A5 - G5 -',
      'A5 - - - E5 - C#5 - E5 - - - . . . .',
    ]),
    lead: 'brass',
    groove: 'funk',
  },
  // Temple hill: A "mohanam"-flavoured pentatonic (A B C# E F#), drone.
  temple: {
    bpm: [90, 118, 130],
    chords: [chord('A1', 'A3', 'E4', 'A4', 'C#5'), chord('F#2', 'F#3', 'C#4', 'F#4', 'A4'), chord('E2', 'E3', 'B3', 'E4', 'G#4'), chord('A1', 'A3', 'E4', 'A4', 'B4')],
    prepChords: [chord('A1', 'A3', 'E4', 'A4'), chord('E2', 'E3', 'B3', 'E4')],
    melody: line([
      'A5 - - - B5 - C#6 - E6 - - - C#6 - B5 -',
      'A5 - - - F#5 - - - E5 - F#5 - A5 - - -',
      'B5 - C#6 - B5 - A5 - F#5 - - - E5 - - -',
      'F#5 - E5 - C#5 - B4 - A4 - - - . . . .',
    ]),
    lead: 'lead',
    groove: 'tabla',
  },
  // Coast: bright G major, off-beat guitar-like plucks.
  coast: {
    bpm: [98, 124, 136],
    chords: [chord('G2', 'G4', 'B4', 'D5'), chord('D2', 'F#4', 'A4', 'D5'), chord('E2', 'E4', 'G4', 'B4'), chord('C2', 'E4', 'G4', 'C5')],
    prepChords: [chord('G2', 'G4', 'B4', 'D5'), chord('C2', 'E4', 'G4', 'C5')],
    melody: line([
      'B5 - - - A5 - G5 - D5 - - - G5 - A5 -',
      'A5 - - - F#5 - - - D5 - E5 - F#5 - - -',
      'G5 - B5 - E6 - - - D6 - B5 - G5 - - -',
      'E5 - G5 - C6 - B5 - A5 - G5 - E5 - . .',
    ]),
    lead: 'lead',
    groove: 'offbeat',
  },
  // Forest: E minor, airy pad and a flute-like lead.
  forest: {
    bpm: [88, 120, 132],
    chords: [chord('E2', 'E4', 'G4', 'B4'), chord('C2', 'E4', 'G4', 'C5'), chord('D2', 'D4', 'F#4', 'A4'), chord('B1', 'Eb4', 'F#4', 'B4')],
    prepChords: [chord('E2', 'E4', 'G4', 'B4'), chord('C2', 'E4', 'G4', 'C5')],
    melody: line([
      'E5 - - - G5 - - - B5 - A5 - G5 - - -',
      'E5 - - - C5 - D5 - E5 - - - . . . .',
      'F#5 - - - A5 - - - D6 - C6 - A5 - - -',
      'B5 - - - A5 - F#5 - Eb5 - - - . . . .',
    ]),
    lead: 'lead',
    groove: 'soft',
  },
  // Village: C major folk tune in a lilting 6/8-ish feel, "nadaswaram"-ish lead.
  village: {
    bpm: [92, 122, 134],
    chords: [chord('C2', 'C4', 'E4', 'G4'), chord('F2', 'F4', 'A4', 'C5'), chord('G2', 'G4', 'B4', 'D5'), chord('C2', 'E4', 'G4', 'C5')],
    prepChords: [chord('C2', 'C4', 'E4', 'G4'), chord('G2', 'G4', 'B4', 'D5')],
    melody: line([
      'G5 - E5 - G5 - A5 - G5 - E5 - D5 - C5 -',
      'A5 - - - G5 - F5 - A5 - - - . . . .',
      'B5 - - - A5 - G5 - D6 - C6 - B5 - A5 -',
      'G5 - E5 - D5 - E5 - C5 - - - . . . .',
    ]),
    lead: 'brass',
    groove: 'tabla',
  },
  // Night city: F minor synthwave, 16th arpeggios, four-on-the-floor.
  night: {
    bpm: [100, 128, 140],
    chords: [chord('F2', 'F4', 'G#4', 'C5'), chord('C#2', 'F4', 'G#4', 'C#5'), chord('G#1', 'Eb4', 'G#4', 'C5'), chord('Eb2', 'Eb4', 'G4', 'Bb4')],
    prepChords: [chord('F2', 'F4', 'G#4', 'C5'), chord('C#2', 'F4', 'G#4', 'C#5')],
    melody: line([
      'C6 - - - G#5 - - - F5 - G5 - G#5 - - -',
      'F5 - - - C#5 - - - F5 - G#5 - C#6 - - -',
      'Eb6 - - - C6 - - - G#5 - Bb5 - C6 - - -',
      'Bb5 - - - G5 - - - Eb5 - - - . . . .',
    ]),
    lead: 'lead',
    groove: 'arp',
  },
}

function scoreFor(styleId: MusicStyle): Score {
  const st = STYLES[styleId]
  return {
    bpm(mood, intense) {
      return mood === 'prep' ? st.bpm[0] : mood === 'boss' || intense ? st.bpm[2] : st.bpm[1]
    },
    play(m, dest, step, t, sd, mood) {
      const s16 = step % 16
      const bar = Math.floor(step / 16)
      if (mood === 'prep') {
        const ch = st.prepChords[bar % st.prepChords.length]
        if (s16 === 0) {
          m.bass(dest, hz(ch.root), t, sd * 12, 0.1)
          for (const n of ch.tones.slice(0, 3)) m.pad(dest, hz(n), t, sd * 16, 0.02)
        }
        if (s16 % 4 === 2) m.pluck(dest, hz(ch.tones[(s16 / 2) % ch.tones.length] + 12), t, sd * 2, 0.035)
        if (s16 % 8 === 4) m.hat(dest, t, 0.015, 0.04)
        return
      }
      const final = mood === 'boss'
      const ch = st.chords[bar % st.chords.length]
      const g = st.groove
      // Bass.
      if (g === 'funk') {
        if ([0, 3, 6, 10, 12, 14].includes(s16)) m.bass(dest, hz(ch.root + (s16 === 12 ? 12 : s16 === 14 ? 7 : 0)), t, sd * 1.4, 0.2)
      } else if (g === 'offbeat') {
        if (s16 === 0 || s16 === 8) m.bass(dest, hz(ch.root), t, sd * 3, 0.2)
        if (s16 === 6 || s16 === 14) m.bass(dest, hz(ch.root + 7), t, sd * 1.5, 0.14)
      } else if (g === 'arp') {
        if (s16 % 2 === 0) m.bass(dest, hz(ch.root + (s16 % 4 === 2 ? 12 : 0)), t, sd * 1.2, 0.17)
      } else if (g === 'tabla') {
        if ([0, 6, 10].includes(s16)) m.bass(dest, hz(ch.root), t, sd * 2, 0.18)
      } else {
        if (s16 === 0 || s16 === 8) m.bass(dest, hz(ch.root), t, sd * 6, 0.16)
      }
      // Drums.
      if (g === 'tabla') {
        if ([0, 6, 10].includes(s16)) m.tom(dest, t, 130, 0.35)
        if ([3, 8, 13].includes(s16)) m.tom(dest, t, 260, 0.2)
        if (s16 % 2 === 1 || final) m.hat(dest, t, 0.02, 0.03)
      } else if (g === 'soft') {
        if (s16 === 0 || s16 === 10) m.kick(dest, t, 0.4)
        if (s16 === 8) m.snare(dest, t, 0.12)
        if (s16 % 4 === 2) m.hat(dest, t, 0.02, 0.05)
      } else {
        if (s16 % 4 === 0 || (g === 'funk' && s16 === 10)) m.kick(dest, t, 0.6)
        if (s16 === 4 || s16 === 12) m.snare(dest, t, 0.22)
        m.hat(dest, t, final || s16 % 2 === 0 ? (s16 % 4 === 2 ? 0.045 : 0.025) : 0, 0.03)
      }
      if (final && bar % 4 === 3 && s16 >= 12) m.tom(dest, t, 220 - (s16 - 12) * 30, 0.28)
      // Harmony.
      if (g === 'offbeat' && s16 % 4 === 2) for (const n of ch.tones) m.pluck(dest, hz(n), t, sd * 1.2, 0.03)
      else if (g === 'arp') m.pluck(dest, hz(ch.tones[s16 % ch.tones.length] + (s16 >= 8 ? 12 : 0)), t, sd * 0.9, 0.028)
      else if (g === 'funk' && (s16 === 0 || s16 === 7)) for (const n of ch.tones) m.brass(dest, hz(n), t, sd * 1.5, 0.03)
      else if (s16 === 0) for (const n of ch.tones) m.pad(dest, hz(n), t, sd * 16, 0.024)
      m.melody(dest, st.melody, step, t, sd, final ? 0.062 : 0.05, st.lead)
      if (final && s16 % 4 === 0) m.pluck(dest, hz(ch.tones[bar % ch.tones.length] + 24), t, sd, 0.02)
    },
    sting(m, g, kind, t) {
      const ch = st.chords[0]
      if (kind === 'victory') {
        const up = [0, 4, 7, 12]
        up.forEach((iv, i) => m.brass(g, hz(ch.root + 24 + iv), t + i * 0.14, i === 3 ? 1.6 : 0.13, 0.14))
        for (const n of ch.tones) m.pad(g, hz(n), t + 0.42, 2.2, 0.05)
        m.bass(g, hz(ch.root), t + 0.42, 1.8, 0.28)
        for (const at of [0, 0.14, 0.28, 0.42]) m.kick(g, t + at, 0.6)
        m.cymbal(g, t + 0.42, 1.8)
        return 2.8
      }
      const pl = [7, 5, 3, 0]
      pl.forEach((iv, i) => m.pluck(g, hz(ch.root + 24 + iv), t + i * 0.28, 0.5, 0.12))
      for (const n of ['C4', 'E4', 'G4']) m.pad(g, hz(N[n]), t + 1.2, 1.4, 0.045)
      return 2.8
    },
  }
}

export class RaceMusic extends GameMusic {
  constructor(style: MusicStyle) {
    super(scoreFor(style))
  }
}

// A quiet, looping environmental bed: filtered noise (wind, waves, city
// hum, crowd) plus sparse synthesized birds/bells. Follows the Music
// toggle, ducks under questions, stops in a background tab.
export class RaceAmbience {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private src: AudioBufferSourceNode | null = null
  private lfo: OscillatorNode | null = null
  private timer: number | null = null
  private enabled = true
  private ducked = false
  private hidden = false
  constructor(private kind: Ambience) {}

  start() {
    const ctx = getAudioContext()
    if (!ctx || this.ctx) return
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(ctx.destination)
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      b = 0.98 * b + 0.02 * (Math.random() * 2 - 1) // brown-ish
      d[i] = b * 3
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const f = ctx.createBiquadFilter()
    const wet = ctx.createGain()
    const k = this.kind
    f.type = k === 'waves' ? 'lowpass' : k === 'city' || k === 'nightCity' ? 'bandpass' : 'lowpass'
    f.frequency.value = k === 'waves' ? 700 : k === 'city' ? 420 : k === 'nightCity' ? 300 : 900
    wet.gain.value = k === 'waves' ? 0.6 : 0.35
    // Waves swell; wind breathes.
    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.frequency.value = k === 'waves' ? 0.12 : 0.05
    lg.gain.value = k === 'waves' ? 0.4 : 0.15
    lfo.connect(lg)
    lg.connect(wet.gain)
    src.connect(f)
    f.connect(wet)
    wet.connect(this.out)
    src.start()
    lfo.start()
    this.src = src
    this.lfo = lfo
    this.timer = window.setInterval(() => this.chirp(), 900)
    this.apply()
  }

  // Occasional birds (forest/village/temple/coast) or a temple bell.
  private chirp() {
    const ctx = this.ctx
    if (!ctx || !this.out || this.hidden || !this.enabled) return
    const k = this.kind
    if (k === 'city' || k === 'nightCity') return
    if (Math.random() > (k === 'forest' ? 0.55 : 0.3)) return
    const t = ctx.currentTime + 0.05
    if (k === 'temple' && Math.random() < 0.35) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 660
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
      o.connect(g)
      g.connect(this.out)
      o.start(t)
      o.stop(t + 2.3)
      return
    }
    const notes = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const f0 = 2400 + Math.random() * 1600
      const tt = t + i * 0.11
      o.type = 'sine'
      o.frequency.setValueAtTime(f0, tt)
      o.frequency.exponentialRampToValueAtTime(f0 * 1.35, tt + 0.07)
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.exponentialRampToValueAtTime(0.02, tt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09)
      o.connect(g)
      g.connect(this.out)
      o.start(tt)
      o.stop(tt + 0.1)
    }
  }

  private apply() {
    if (!this.ctx || !this.out) return
    const level = !this.enabled || this.hidden ? 0 : this.ducked ? 0.04 : 0.1
    this.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4)
  }
  setEnabled(on: boolean) {
    this.enabled = on
    this.apply()
  }
  duck(on: boolean) {
    this.ducked = on
    this.apply()
  }
  setHidden(h: boolean) {
    this.hidden = h
    this.apply()
  }
  dispose() {
    if (this.timer) window.clearInterval(this.timer)
    try {
      this.src?.stop()
      this.lfo?.stop()
    } catch {
      // already stopped
    }
    this.out?.disconnect()
    this.ctx = null
    this.out = null
  }
}
