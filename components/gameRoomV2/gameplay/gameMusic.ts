'use client'

import { getAudioContext } from '@/components/gameRoomV2/gameplay/playSound'

// The shared GameRoom V2 background-music engine: a look-ahead
// scheduler, a small synthesizer (pluck, lead, brass, pad, bass, drums)
// and the signal chain (mood gain -> duck gain -> music gain ->
// compressor). Each game supplies its own ORIGINAL score (a `Score`:
// tempo, what to play on each 16th step of each mood, and its stings) --
// see towerDefense/music.ts and bossBattle/brawl/music.ts.
//
// - Shares the one GameRoom V2 AudioContext with the SFX engine and only
//   starts after a user gesture (start() is called from a click).
// - setInterval 25 ms, ~120 ms ahead: sample-accurate timing without rAF.
// - duck() lowers the music under a Tamil question; setEnabled() is the
//   Music toggle; setHidden() stops scheduling in a background tab;
//   dispose() clears the interval and disconnects everything.

export type MusicMood = 'prep' | 'battle' | 'boss' | 'silent'

const MUSIC_LEVEL = 0.26
const DUCK_LEVEL = 0.38

// MIDI note -> Hz.
export const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
// Note names (octave 4 = middle).
export const N: Record<string, number> = {}
;['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].forEach((n, i) => {
  for (let o = 1; o <= 6; o++) N[`${n}${o}`] = 12 * (o + 1) + i
})

export interface Chord {
  root: number // bass note (MIDI)
  tones: number[] // voicing (MIDI)
}
export const chord = (root: string, ...tones: string[]): Chord => ({ root: N[root], tones: tones.map((t) => N[t]) })

// A melody: one entry per 16th step; null = rest, -1 = hold, else MIDI.
export function line(bars: string[]): (number | null)[] {
  const out: (number | null)[] = []
  for (const bar of bars) {
    const toks = bar.trim().split(/\s+/)
    for (const t of toks) out.push(t === '.' ? null : t === '-' ? -1 : N[t])
  }
  return out
}

export interface Score {
  bpm(mood: MusicMood, intense: boolean): number
  // Schedules whatever sounds on this 16th step of the mood.
  play(m: GameMusic, dest: AudioNode, step: number, t: number, sd: number, mood: MusicMood, intense: boolean): void
  // Schedules a one-shot sting; returns its length in seconds.
  sting(m: GameMusic, dest: AudioNode, kind: 'victory' | 'defeat', t: number): number
}

export class GameMusic {
  constructor(private score: Score) {}


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
    this.stingUntil = t + this.score.sting(this, g, kind, t)
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
    return this.score.bpm(this.mood, this.intense)
  }

  private tick() {
    const ctx = this.ctx
    if (!ctx || !this.moodG || this.mood === 'silent') return
    const stepDur = 60 / this.bpm() / 4
    // After a long stall (tab throttling), skip ahead rather than burst.
    if (this.nextAt < ctx.currentTime - 0.2) this.nextAt = ctx.currentTime + 0.05
    while (this.nextAt < ctx.currentTime + 0.12) {
      if (this.nextAt >= this.stingUntil) this.score.play(this, this.moodG, this.step, this.nextAt, stepDur, this.mood, this.intense)
      this.nextAt += stepDur
      this.step++
    }
  }

  melody(dest: AudioNode, mel: (number | null)[], step: number, t: number, sd: number, gain: number, voice: 'lead' | 'brass') {
    const i = step % mel.length
    const n = mel[i]
    if (n === null || n < 0) return
    let len = 1
    while (mel[(i + len) % mel.length] === -1 && len < 16) len++
    if (voice === 'lead') this.lead(dest, hz(n), t, sd * len, gain)
    else this.brass(dest, hz(n), t, sd * len, gain, 1400)
  }

  // --- Voices ------------------------------------------------------------

  env(g: GainNode, t: number, peak: number, attack: number, dur: number, release = 0.08) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release)
  }

  osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator()
    o.type = type
    o.frequency.value = f
    o.detune.value = detune
    o.connect(dest)
    o.start(t)
    o.stop(end)
    return o
  }

  pluck(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
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

  lead(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
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

  brass(dest: AudioNode, f: number, t: number, dur: number, gain: number, cutoff = 1800) {
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

  pad(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
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

  bass(dest: AudioNode, f: number, t: number, dur: number, gain: number) {
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

  kick(dest: AudioNode, t: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    const o = this.osc('sine', 140, t, t + 0.32, g)
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18)
  }

  tom(dest: AudioNode, t: number, f: number, gain: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    const o = this.osc('sine', f, t, t + 0.27, g)
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.2)
  }

  noiseHit(dest: AudioNode, t: number, gain: number, dur: number, type: BiquadFilterType, freq: number) {
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

  hat(dest: AudioNode, t: number, gain: number, dur: number) {
    this.noiseHit(dest, t, gain, dur, 'highpass', 7000)
  }

  snare(dest: AudioNode, t: number, gain: number) {
    this.noiseHit(dest, t, gain, 0.16, 'bandpass', 1800)
    const g = this.ctx!.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(gain * 0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    this.osc('triangle', 190, t, t + 0.12, g)
  }

  cymbal(dest: AudioNode, t: number, dur: number) {
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
