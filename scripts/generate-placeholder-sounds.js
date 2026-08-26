// One-off script: synthesizes three simple placeholder WAV tones for
// Game Room's new sound effects (correct/incorrect/completion) -- no
// external audio assets needed, nothing to license. Run once via
// `node scripts/generate-placeholder-sounds.js`; output files are
// committed to public/sounds/ and are trivially swappable for real
// branded sound assets later.
const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100

function writeWavFile(filePath, samples) {
  const numSamples = samples.length
  const byteRate = SAMPLE_RATE * 2
  const buffer = Buffer.alloc(44 + numSamples * 2)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + numSamples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(numSamples * 2, 40)

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  }

  fs.writeFileSync(filePath, buffer)
}

function envelope(t, duration) {
  // Quick attack, gentle release -- avoids a harsh click at start/end.
  const attack = 0.01
  const release = duration * 0.3
  if (t < attack) return t / attack
  if (t > duration - release) return Math.max(0, (duration - t) / release)
  return 1
}

function tone(freqs, duration) {
  const numSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    let value = 0
    for (const freq of freqs) {
      value += Math.sin(2 * Math.PI * freq * t)
    }
    value /= freqs.length
    samples[i] = value * envelope(t, duration) * 0.6
  }
  return samples
}

// Two-note ascending chime -- bright, positive.
function correctTone() {
  const a = tone([880], 0.12)
  const b = tone([1318.5], 0.16)
  return [...a, ...b]
}

// Single short low buzz -- gentle, not harsh.
function incorrectTone() {
  return tone([220, 233], 0.18)
}

// Three-note ascending fanfare.
function completeTone() {
  const a = tone([523.25], 0.14)
  const b = tone([659.25], 0.14)
  const c = tone([783.99, 1046.5], 0.35)
  return [...a, ...b, ...c]
}

const outDir = path.join(__dirname, '..', 'public', 'sounds')
fs.mkdirSync(outDir, { recursive: true })

writeWavFile(path.join(outDir, 'correct.wav'), correctTone())
writeWavFile(path.join(outDir, 'incorrect.wav'), incorrectTone())
writeWavFile(path.join(outDir, 'complete.wav'), completeTone())

console.log('Generated placeholder sounds in public/sounds/')
