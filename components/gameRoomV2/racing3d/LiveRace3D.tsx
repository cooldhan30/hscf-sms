'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FiFlag } from 'react-icons/fi'
import { buildRoad, LAPS, MAX_SPEED, KMH_AT_MAX, type TrackDef } from '@/lib/gameRoomV2/racing3d'
import type { LiveRaceResponse } from '@/lib/gameRoomV2/racing'
import { useGameV2Motion } from '@/components/gameRoomV2/useGameV2Motion'
import { TouchControls } from '@/components/gameRoomV2/racing/TouchControls'
import { emptyControls, readControls, useDriveKeyboard } from '@/components/gameRoomV2/racing/useDriveInput'
import { TA } from '@/lib/gameRoomV2/i18n/ta'
import { createRenderer, createResolutionGovernor, type CameraMode, type Renderer } from './render'

// Live Classroom racing in the same driver-view world as solo racing --
// but every racer's position is the SERVER's (lib/gameRoomV2/racing's
// replay of each classmate's graded answers, polled from
// /api/gameroom-v2/live/[id]/race). The client only interpolates between
// polls and lets the student steer their car across the lanes; it never
// computes or reports anyone's progress, so nobody can race ahead by
// driving (or cheating) -- in class, Tamil answers drive the car.
// Real classmates only: no simulated racers are ever added here.

const PALETTE = ['#eab308', '#0ea5e9', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#14b8a6', '#ef4444', '#6366f1', '#84cc16']
const LANES = [-0.55, 0.55, 0, -0.3, 0.3, -0.75, 0.75]

interface Track {
  frac: number // displayed
  target: number
  prevTarget: number
  at: number // ms of last poll
  rate: number // frac per ms
}

export function LiveRace3D({
  track,
  race,
  myParticipantId,
  camera,
  paused,
  children,
}: {
  track: TrackDef
  race: LiveRaceResponse
  myParticipantId: string
  camera: CameraMode
  paused: boolean
  children?: ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduced = !!useGameV2Motion().reduced
  const road = useMemo(() => buildRoad(track), [track])
  const colors = useMemo(() => {
    const m = new Map<string, string>()
    race.racers.forEach((r, i) => m.set(r.participantId, r.participantId === myParticipantId ? PALETTE[0] : PALETTE[1 + (i % (PALETTE.length - 1))]))
    return m
    // Colours are fixed per participant for the whole race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.racers.length, myParticipantId])
  const rendererRef = useRef<Renderer | null>(null)
  const governorRef = useRef(createResolutionGovernor())
  const tracks = useRef(new Map<string, Track>())
  const raceRef = useRef(race)
  raceRef.current = race
  const controls = useRef(emptyControls())
  const myX = useRef(0)
  const [touchUi, setTouchUi] = useState(false)
  const [hud, setHud] = useState({ place: 1, lap: 1, speed: 0 })

  useEffect(() => {
    setTouchUi(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  useEffect(() => {
    const r = createRenderer(track, PALETTE)
    rendererRef.current = r
    return () => r.dispose()
  }, [track])

  // Each poll moves every racer's target; the display eases toward it and
  // extrapolates at the racer's recent pace, never backwards.
  useEffect(() => {
    const now = performance.now()
    const len = race.trackLength || 1
    for (const r of race.racers) {
      const target = Math.min(1, r.distance / len)
      const t = tracks.current.get(r.participantId)
      if (!t) tracks.current.set(r.participantId, { frac: target, target, prevTarget: target, at: now, rate: 0 })
      else {
        const dtMs = Math.max(200, now - t.at)
        t.rate = Math.max(0, (target - t.target) / dtMs)
        t.prevTarget = t.target
        t.target = Math.max(t.target, target)
        t.at = now
      }
    }
  }, [race])

  useDriveKeyboard({ controls, enabled: !paused, onPause: () => {} })

  useEffect(() => {
    if (paused) return
    let raf = 0
    const governor = governorRef.current
    let last = performance.now()
    let hudAcc = 0
    const raceLength = road.lapLength * LAPS
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      const rr = rendererRef.current
      if (!canvas || !rr) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const racers = raceRef.current.racers
      for (const r of racers) {
        const t = tracks.current.get(r.participantId)
        if (!t) continue
        const want = Math.min(1, r.finished ? 1 : t.target + t.rate * Math.min(1500, now - t.at))
        if (want > t.frac) t.frac += (want - t.frac) * Math.min(1, dt * 2.5)
      }
      const k = readControls(controls.current)
      myX.current += k.steer * dt * 1.4
      if (k.steer === 0) myX.current *= 1 - Math.min(1, dt * 0.6)
      myX.current = Math.max(-0.8, Math.min(0.8, myX.current))
      const me = tracks.current.get(myParticipantId)
      const myZ = (me?.frac ?? 0) * raceLength
      const myRate = me ? me.rate * 1000 * raceLength : 0 // units/s
      const dpr = governor.ratio(dt * 1000)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const g = canvas.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const meRacer = racers.find((r) => r.participantId === myParticipantId)
      const boost = meRacer?.effect?.kind === 'boost'
      rr.draw(g, w, h, {
        track,
        road,
        camZ: myZ,
        camX: myX.current,
        speedPct: Math.min(1.3, myRate / MAX_SPEED),
        steer: k.steer,
        cars: racers.map((r, i) => {
          const t = tracks.current.get(r.participantId)
          const isMe = r.participantId === myParticipantId
          return {
            id: r.participantId,
            z: (t?.frac ?? 0) * raceLength,
            x: isMe ? myX.current : LANES[i % LANES.length] + Math.sin(now / 900 + i) * 0.08,
            color: colors.get(r.participantId) ?? PALETTE[1],
            isPlayer: isMe,
            boosting: r.effect?.kind === 'boost',
            shielded: false,
            label: isMe ? undefined : r.nickname,
          }
        }),
        coins: [],
        isCoinTaken: () => true,
        checkpoints: [],
        camera,
        time: now / 1000,
        boost,
        shield: false,
        offroad: false,
        crash: 0,
        magnet: false,
        reduced,
        finishDistance: raceLength,
      })
      hudAcc += dt
      if (hudAcc > 0.2) {
        hudAcc = 0
        const place = racers.findIndex((r) => r.participantId === myParticipantId) + 1
        setHud({ place: Math.max(1, place), lap: Math.min(LAPS, Math.floor((me?.frac ?? 0) * LAPS) + 1), speed: Math.round((myRate / MAX_SPEED) * KMH_AT_MAX) })
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [paused, road, track, camera, reduced, myParticipantId, colors])

  const n = race.racers.length
  return (
    <div className="fixed inset-0 overflow-hidden bg-stone-900 select-none" style={{ height: '100dvh' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" role="img" aria-label={`${track.tamilName} · ${track.name}`} />
      <div className="pointer-events-none absolute left-2 top-2 sm:left-3 sm:top-3 z-20 flex gap-1.5 [padding-top:env(safe-area-inset-top)]">
        <div className="rounded-2xl bg-white/90 shadow-md px-2.5 py-1.5 text-center min-w-[58px]" aria-label={`இடம் · Position ${hud.place} / ${n}`}>
          <p className="text-2xl font-black text-primary-700 leading-none tabular-nums">
            {hud.place}
            <span className="text-sm text-stone-400">/{n}</span>
          </p>
          <p className="font-tamil text-[10px] font-bold text-stone-500">{TA.position.ta}</p>
        </div>
        <div className="rounded-2xl bg-white/90 shadow-md px-2.5 py-1.5 text-center">
          <p className="text-lg font-black text-stone-800 leading-none tabular-nums">
            {hud.lap}/{LAPS}
          </p>
          <p className="font-tamil text-[10px] font-bold text-stone-500">{TA.lap.ta}</p>
        </div>
        <div className="rounded-2xl bg-black/55 px-2.5 py-1.5 text-center text-white">
          <p className="text-lg font-black leading-none tabular-nums">{hud.speed}</p>
          <p className="text-[10px] font-bold opacity-80">km/h</p>
        </div>
      </div>
      {/* Class standings, from the server. */}
      <ol className="pointer-events-none absolute left-2 top-[4.6rem] sm:left-3 z-20 space-y-1 max-w-[46vw]" aria-label="வகுப்பு நிலைகள் · Class standings">
        {race.racers.slice(0, 6).map((r, i) => (
          <li key={r.participantId} className={`flex items-center gap-1.5 rounded-xl px-2 py-0.5 text-xs font-bold shadow ${r.participantId === myParticipantId ? 'bg-gold-300 text-stone-900' : 'bg-white/85 text-stone-700'}`}>
            <span className="tabular-nums">{i + 1}</span>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.get(r.participantId) }} aria-hidden />
            <span className="truncate">{r.participantId === myParticipantId ? 'நீங்கள்' : r.nickname}</span>
            {r.finished && <FiFlag className="w-3 h-3" aria-label="முடித்தார் · Finished" />}
          </li>
        ))}
      </ol>
      {touchUi && !paused && (
        <TouchControls controls={controls} boostReady={false} boosting={false} disabled={paused} steerOnly />
      )}
      {children}
    </div>
  )
}
