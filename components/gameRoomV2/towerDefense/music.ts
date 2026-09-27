'use client'

import { getAudioContext } from '@/components/gameRoomV2/gameplay/playSound'

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
// Design:
// - Shares the one GameRoom V2 AudioContext with the SFX engine and only
//   starts after a user gesture (start() is called from a click).
// - A look-ahead scheduler (setInterval 25 ms, ~120 ms ahead) -- the
//   standard way to get sample-accurate timing without a rAF.
// - Signal chain: voices -> mood gain (crossfades) -> duck gain (lowered
//   while a Tamil question is on screen) -> music gain (the Music toggle)
//   -> compressor -> destination.
// - stop()/dispose() clear the interval and disconnect everything; hidden
//   tabs pause scheduling entirely.

export type MusicMood = 'prep' | 'battle' | 'boss' | 'silent'

const MUSIC_LEVEL = 0.26
const DUCK_LEVEL = 0.38

// MIDI note -> Hz.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
// Note names used in the score (octave 4 = middle).
const N: Record<string, number> = {}
;['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].forEach((n, i) => {
  for (let o = 1; o <= 6; o++) N[`${n}${o}`] = 12 * (o + 1) + i
})

interface Chord {
  root: number // bass note (MIDI)
  tones: number[] // voicing (MIDI)
}
const chord = (root: string, ...tones: string[]): Chord => ({ root: N[root], tones: tones.map((t) => N[t]) })

// Harmony.
const PREP_CHORDS = [chord('D2', 'D4', 'F4', 'A4', 'E5'), chord('Bb1', 'D4', 'F4', 'Bb4', 'C5'), chord('F2', 'C4', 'F4', 'A4', 'G5'), chord('C2', 'C4', 'E4', 'G4', 'D5')]
const BATTLE_CHORDS = [chord('D2', 'D4', 'F4', 'A4'), chord('C2', 'C4', 'E4', 'G4'), chord('Bb1', 'Bb3', 'D4', 'F4'), chord('A1', 'A3', 'C#4', 'E4')]
const BOSS_CHORDS = [chord('D2', 'D4', 'F4', 'A4'), chord('Eb2', 'Eb4', 'G4', 'Bb4'), chord('D2', 'D4', 'F4', 'A4'), chord('C#2', 'C#4', 'E4', 'G4')]

// Melodies: one entry per 16th step over 8 bars (128 steps); null = rest,
// a note name starts a note held until the next entry.
function line(bars: string[]): (number | null)[] {
  const out: (number | null)[] = []
  for (const bar of bars) {
    const toks = bar.trim().split(/\s+/)
    for (const t of toks) out.push(t === '.' ? null : t === '-' ? -1 : N[t])
  }
  return out
}
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

export class TdMusic {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null // Music toggle / master
  private duckG: GainNode | null = null
  private comp: DynamicsCompressorNode | null = null
  private moodG: GainNode | null = null
  private noise: AudioBuffer | null = null
  private timer: number | null = null
  private mood: MusicMood = 'silent'
  private intense = false
  private enabled = true
  private ducked = false
  private hidden = false
  private step = 0
  private nextAt = 0
  private stingUntil = 0

  // Called from a click handler: creates/resumes the audio graph.
  start() {
    const ctx = getAudioContext()
    if (!ctx) return
    if (!this.ctx) {
      this.ctx = ctx
      this.comp = ctx.createDynamicsCompressor()
      this.comp.threshold.value = -18
      this.comp.ratio.value = 4
      this.out = ctx.createGain()
      this.out.gain.value = 0
      this.duckG = ctx.createGain()
      this.duckG.gain.value = this.ducked ? DUCK_LEVEL : 1
      this.duckG.connect(this.out)
      this.out.connect(this.comp)
      this.comp.connect(ctx.destination)
      const len = ctx.sampleRate
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    // A mood chosen before the first gesture starts now.
    if (!this.moodG && this.mood !== 'silent') {
      const m = this.mood
      this.mood = 'silent'
      this.setMood(m, this.intense)
    }
    this.applyLevel(0.6)
    this.ensureTimer()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    this.applyLevel(0.5)
    this.ensureTimer()
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden
    this.applyLevel(0.2)
    this.ensureTimer()
  }

  duck(on: boolean) {
    this.ducked = on
    if (!this.ctx || !this.duckG) return
    const t = this.ctx.currentTime
    this.duckG.gain.cancelScheduledValues(t)
    this.duckG.gain.setValueAtTime(this.duckG.gain.value, t)
    this.duckG.gain.linearRampToValueAtTime(on ? DUCK_LEVEL : 1, t + (on ? 0.35 : 0.9))
  }

  setMood(mood: MusicMood, intense = false) {
    if (mood === this.mood && intense === this.intense) return
    const changed = mood !== this.mood
    this.mood = mood
    this.intense = intense
    if (!this.ctx || !this.duckG) return
    if (!changed) return
    const t = this.ctx.currentTime
    // Fade the previous mood's tail out; the new one fades in on a fresh bar.
    if (this.moodG) {
      const old = this.moodG
      old.gain.cancelScheduledValues(t)
      old.gain.setValueAtTime(old.gain.value, t)
      old.gain.linearRampToValueAtTime(0, t + 0.9)
      window.setTimeout(() => old.disconnect(), 1500)
    }
    this.moodG = this.ctx.createGain()
    this.moodG.gain.setValueAtTime(0, t)
    this.moodG.gain.linearRampToValueAtTime(1, t + (mood === 'boss' ? 0.4 : 1.2))
    this.moodG.connect(this.duckG)
    this.step = 0
    this.nextAt = Math.max(t + 0.05, this.stingUntil)
  }

  // A one-shot sting; the current mood goes silent first.
  sting(kind: 'victory' | 'defeat') {
    this.setMood('silent')
    if (!this.ctx || !this.duckG || !this.enabled) return
    const ctx = this.ctx
    const g = ctx.createGain()
    g.connect(this.duckG)
    const t = ctx.currentTime + 0.05
    if (kind === 'victory') {
      // Fanfare: D major, rising triplet then a held chord with a cymbal swell.
      const brassNotes: [string, number, number][] = [
        ['D4', 0, 0.16], ['F#4', 0.16, 0.16], ['A4', 0.32, 0.16],
        ['D5', 0.5, 0.35], ['A4', 0.86, 0.14], ['D5', 1.0, 0.14], ['F#5', 1.14, 1.6],
      ]
      for (const [n, at, dur] of brassNotes) this.brass(g, hz(N[n]), t + at, dur, 0.16)
      for (const n of ['D3', 'A3', 'D4', 'F#4', 'A4']) this.pad(g, hz(N[n]), t + 1.1, 2.2, 0.05)
      this.bass(g, hz(N['D2']), t + 1.1, 1.8, 0.3)
      for (const at of [0, 0.5, 1.1]) this.kick(g, t + at, 0.7)
      this.cymbal(g, t + 1.1, 1.8)
      this.stingUntil = t + 3.2
    } else {
      // Gentle fall, then a warm "try again" resolution.
      const pl: [string, number][] = [['A4', 0], ['F4', 0.3], ['D4', 0.6], ['C#4', 0.9]]
      for (const [n, at] of pl) this.pluck(g, hz(N[n]), t + at, 0.6, 0.14)
      for (const n of ['Bb3', 'D4', 'F4']) this.pad(g, hz(N[n]), t + 1.3, 1.1, 0.05)
      for (const n of ['F3', 'A3', 'C4', 'F4']) this.pad(g, hz(N[n]), t + 2.3, 1.8, 0.05)
      this.bass(g, hz(N['Bb1']), t + 1.3, 1.0, 0.22)
      this.bass(g, hz(N['F2']), t + 2.3, 1.6, 0.22)
      this.pluck(g, hz(N['A4']), t + 2.3, 1.2, 0.1)
      this.pluck(g, hz(N['C5']), t + 2.5, 1.2, 0.08)
      this.stingUntil = t + 4
    }
    window.setTimeout(() => g.disconnect(), 5000)
  }

  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    try {
      this.moodG?.disconnect()
      this.duckG?.disconnect()
      this.out?.disconnect()
      this.comp?.disconnect()
    } catch {
      // already disconnected
    }
    this.ctx = null
    this.moodG = null
    this.duckG = null
    this.out = null
    this.comp = null
  }

  private audible() {
    return this.enabled && !this.hidden
  }

  private applyLevel(ramp: number) {
    if (!this.ctx || !this.out) return
    const t = this.ctx.currentTime
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setValueAtTime(this.out.gain.value, t)
    this.out.gain.linearRampToValueAtTime(this.audible() ? MUSIC_LEVEL : 0, t + ramp)
  }

  // The scheduler only runs while music can actually be heard.
  private ensureTimer() {
    const want = !!this.ctx && this.audible()
    if (want && this.timer === null) {
      this.nextAt = Math.max(this.nextAt, this.ctx!.currentTime + 0.05)
      this.timer = window.setInterval(() => this.tick(), 25)
    } else if (!want && this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private bpm() {
    return this.mood === 'prep' ? 92 : this.mood === 'battle' ? 124 : this.intense ? 146 : 136
  }

  private tick() {
    const ctx = this.ctx
    if (!ctx || !this.moodG || this.mood === 'silent') return
    const stepDur = 60 / this.bpm() / 4
    // After a long stall (tab throttling), skip ahead rather than burst.
    if (this.nextAt < ctx.currentTime - 0.2) this.nextAt = ctx.currentTime + 0.05
    while (this.nextAt < ctx.currentTime + 0.12) {
      if (this.nextAt >= this.stingUntil) this.play(this.step, this.nextAt, stepDur)
      this.nextAt += stepDur
      this.step++
    }
  }

  private play(step: number, t: number, sd: number) {
    const dest = this.moodG!
    const s16 = step % 16
    const bar = Math.floor(step / 16)
    if (this.mood === 'prep') {
      const ch = PREP_CHORDS[bar % 4]
      if (s16 === 0) {
        this.bass(dest, hz(ch.root), t, sd * 14, 0.12)
        for (const n of ch.tones.slice(0, 3)) this.pad(dest, hz(n), t, sd * 16, 0.02)
      }
      if (s16 === 8) this.bass(dest, hz(ch.root + 7), t, sd * 6, 0.08)
      // Rolling arpeggio on eighths.
      if (s16 % 2 === 0) {
        const order = [0, 1, 2, 3, 2, 1, 3, 2]
        this.pluck(dest, hz(ch.tones[order[(s16 / 2) % 8]]), t, sd * 3, 0.05)
      }
      if (s16 % 4 === 2) this.hat(dest, t, 0.018, 0.05)
      this.melody(dest, PREP_MELODY, step, t, sd, 0.055, 'lead')
    } else if (this.mood === 'battle') {
      const ch = BATTLE_CHORDS[bar % 4]
      if (s16 % 2 === 0) {
        const oct = s16 % 8 === 6 ? 12 : s16 % 8 === 4 ? 7 : 0
        this.bass(dest, hz(ch.root + oct), t, sd * 1.8, 0.2)
      }
      if (s16 === 0 || s16 === 8 || s16 === 11) this.kick(dest, t, 0.6)
      if (s16 === 4 || s16 === 12) this.snare(dest, t, 0.22)
      if (s16 % 2 === 0) this.hat(dest, t, s16 % 4 === 2 ? 0.05 : 0.03, 0.04)
      if (bar % 4 === 3 && s16 >= 12) this.tom(dest, t, 180 - (s16 - 12) * 25, 0.3)
      if (s16 === 0 || s16 === 3 || s16 === 6) for (const n of ch.tones) this.brass(dest, hz(n), t, sd * (s16 === 6 ? 6 : 2), 0.035)
      this.melody(dest, BATTLE_MELODY, step, t, sd, 0.06, 'lead')
    } else if (this.mood === 'boss') {
      const ch = BOSS_CHORDS[bar % 4]
      const ost = BOSS_OSTINATO[s16]
      if (ost !== null && ost > 0) this.brass(dest, hz(ost + (ch.root - N['D2'])), t, sd * 1.6, 0.14, 700)
      if (s16 % 4 === 0) this.kick(dest, t, 0.75)
      if (s16 === 4 || s16 === 12) this.snare(dest, t, 0.26)
      this.hat(dest, t, this.intense || s16 % 2 === 0 ? 0.035 : 0, 0.03)
      if (s16 === 0) for (const n of ch.tones) this.pad(dest, hz(n), t, sd * 16, 0.03)
      this.melody(dest, BOSS_HOOK, step, t, sd, 0.06, 'brass')
      if (this.intense && s16 % 2 === 0) this.pluck(dest, hz(ch.tones[(s16 / 2) % ch.tones.length] + 12), t, sd * 1.5, 0.035)
    }
  }

  private melody(dest: AudioNode, mel: (number | null)[], step: number, t: number, sd: number, gain: number, voice: 'lead' | 'brass') {
    const i = step % mel.length
    const n = mel[i]
    if (n === null || n < 0) return
    let len = 1
    while (mel[(i + len) % mel.length] === -1 && len < 16) len++
    if (voice === 'lead') this.lead(dest, hz(n), t, sd * len, gain)
    else this.brass(dest, hz(n), t, sd * len, gain, 1400)
  }

  // --- Voices ------------------------------------------------------------

  private env(g: GainNode, t: number, peak: number, attack: number, dur: number, release = 0.08) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release)
  }

  private osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.value = f
    o.detune.value = detune
    o.connect(dest)
    o.start(t)
    o.stop(end)
    return o
  }

  private pluck(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, t)
    lp.frequency.exponentialRampToValueAtTime(700, t + dur)
    lp.connect(g)
    g.connect(dest)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    this.osc('triangle', f, t, t + dur + 0.05, lp)
    this.osc('sine', f * 2, t, t + dur + 0.05, lp)
  }

  private lead(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    lp.connect(g)
    g.connect(dest)
    this.env(g, t, gain, 0.02, dur, 0.12)
    const o = this.osc('square', f, t, t + dur + 0.2, lp)
    this.osc('triangle', f, t, t + dur + 0.2, lp, 6)
    // A little vibrato on longer notes.
    if (dur > 0.3) {
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      lfo.frequency.value = 5.5
      lg.gain.setValueAtTime(0, t)
      lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.3)
      lfo.connect(lg)
      lg.connect(o.frequency)
      lfo.start(t)
      lfo.stop(t + dur + 0.2)
    }
  }

  private brass(dest: AudioNode, f: number, t: number, dur: number, gain: number, cutoff = 1800) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(cutoff * 0.35, t)
    lp.frequency.linearRampToValueAtTime(cutoff, t + 0.06)
    lp.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + dur + 0.1)
    lp.connect(g)
    g.connect(dest)
    this.env(g, t, gain, 0.03, dur, 0.1)
    this.osc('sawtooth', f, t, t + dur + 0.2, lp, -5)
    this.osc('sawtooth', f, t, t + dur + 0.2, lp, 5)
  }

  private pad(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    lp.connect(g)
    g.connect(dest)
    this.env(g, t, gain, Math.min(0.5, dur * 0.3), dur, 0.4)
    this.osc('sawtooth', f, t, t + dur + 0.5, lp, -8)
    this.osc('sawtooth', f, t, t + dur + 0.5, lp, 8)
  }

  private bass(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    lp.connect(g)
    g.connect(dest)
    this.env(g, t, gain, 0.01, dur, 0.06)
    this.osc('triangle', f, t, t + dur + 0.1, lp)
    this.osc('sine', f / 2, t, t + dur + 0.1, lp)
  }

  private kick(dest: AudioNode, t: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    const o = this.osc('sine', 140, t, t + 0.32, g)
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18)
  }

  private tom(dest: AudioNode, t: number, f: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    const o = this.osc('sine', f, t, t + 0.27, g)
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.2)
  }

  private noiseHit(dest: AudioNode, t: number, gain: number, dur: number, type: BiquadFilterType, freq: number) {
    if (gain <= 0 || !this.noise) return
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    src.connect(f)
    f.connect(g)
    g.connect(dest)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  private hat(dest: AudioNode, t: number, gain: number, dur: number) {
    this.noiseHit(dest, t, gain, dur, 'highpass', 7000)
  }

  private snare(dest: AudioNode, t: number, gain: number) {
    this.noiseHit(dest, t, gain, 0.16, 'bandpass', 1800)
    const g = this.ctx!.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain * 0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    this.osc('triangle', 190, t, t + 0.12, g)
  }

  private cymbal(dest: AudioNode, t: number, dur: number) {
    if (!this.noise) return
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 5000
    const g = ctx.createGain()
    src.connect(f)
    f.connect(g)
    g.connect(dest)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.start(t)
    src.stop(t + dur + 0.05)
  }
}
