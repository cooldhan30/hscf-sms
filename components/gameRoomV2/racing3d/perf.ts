// Frame-time instrumentation for Tamil Grand Prix. Always on and cheap
// (fixed ring buffers, no allocation per frame); read by automated
// playtests via window.__tamizhiRacePerf when the opt-in e2e flag is set.

const N = 4096

export interface PerfSummary {
  frames: number
  seconds: number
  fps: number
  frameMs: { p50: number; p95: number; p99: number; max: number }
  longFrames: number // > 25 ms (a visibly dropped frame at 60 Hz)
  simMs: { avg: number; max: number }
  renderMs: { avg: number; p95: number; max: number }
  steps: number
  reactRenders: number
  reactRendersPerSecond: number
}

export function createPerf() {
  const frame = new Float32Array(N)
  const sim = new Float32Array(N)
  const render = new Float32Array(N)
  let count = 0
  let steps = 0
  let seconds = 0
  let reactRenders = 0
  const pct = (a: Float32Array, n: number, p: number) => {
    const s = Array.from(a.subarray(0, n)).sort((x, y) => x - y)
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0
  }
  return {
    frame(frameMs: number, simMs: number, renderMs: number, stepsThisFrame: number) {
      const i = count % N
      frame[i] = frameMs
      sim[i] = simMs
      render[i] = renderMs
      count++
      steps += stepsThisFrame
      seconds += frameMs / 1000
    },
    reactRender() {
      reactRenders++
    },
    reset() {
      count = 0
      steps = 0
      seconds = 0
      reactRenders = 0
    },
    summary(): PerfSummary {
      const n = Math.min(count, N)
      let simSum = 0
      let simMax = 0
      let rSum = 0
      let rMax = 0
      let fMax = 0
      let long = 0
      for (let i = 0; i < n; i++) {
        simSum += sim[i]
        simMax = Math.max(simMax, sim[i])
        rSum += render[i]
        rMax = Math.max(rMax, render[i])
        fMax = Math.max(fMax, frame[i])
        if (frame[i] > 25) long++
      }
      return {
        frames: count,
        seconds,
        fps: seconds > 0 ? count / seconds : 0,
        frameMs: { p50: pct(frame, n, 0.5), p95: pct(frame, n, 0.95), p99: pct(frame, n, 0.99), max: fMax },
        longFrames: long,
        simMs: { avg: n ? simSum / n : 0, max: simMax },
        renderMs: { avg: n ? rSum / n : 0, p95: pct(render, n, 0.95), max: rMax },
        steps,
        reactRenders,
        reactRendersPerSecond: seconds > 0 ? reactRenders / seconds : 0,
      }
    },
  }
}

export type Perf = ReturnType<typeof createPerf>
