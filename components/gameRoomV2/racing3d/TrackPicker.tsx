'use client'

import { useEffect, useRef, useState } from 'react'
import { FiFlag, FiVideo } from 'react-icons/fi'
import { TRACKS, RIVALS, PLAYER_COLOR, buildRoad, type Difficulty, type TrackDef } from '@/lib/gameRoomV2/racing3d'
import { TA } from '@/lib/gameRoomV2/i18n/ta'
import { createRenderer, type CameraMode } from './render'

// The pre-race screen: pick one of the six tracks (each shown as a real
// rendered frame of that road), a difficulty and a camera, then start.
// Tamizhi surface (white card, teal primary) over the selected track.

function renderPreview(canvas: HTMLCanvasElement, track: TrackDef, frac: number) {
  const road = buildRoad(track)
  const r = createRenderer(track, [PLAYER_COLOR, ...RIVALS.map((x) => x.color)])
  const w = canvas.clientWidth || canvas.width
  const h = canvas.clientHeight || canvas.height
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const g = canvas.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const z = road.lapLength * frac
  r.draw(g, w, h, {
    track, road, camZ: z, camX: 0.15, speedPct: 0.6, steer: 0,
    cars: [
      { id: 'player', z, x: 0.15, color: PLAYER_COLOR, isPlayer: true, boosting: false, shielded: false },
      ...RIVALS.map((rv, i) => ({ id: rv.id, z: z + 1800 + i * 1500, x: [-0.4, 0.35, -0.1][i], color: rv.color, isPlayer: false, boosting: false, shielded: false, label: rv.tamilName })),
    ],
    coins: [], isCoinTaken: () => false, checkpoints: [], camera: 'chase', time: 0, boost: false, shield: false, offroad: false, crash: 0, magnet: false, reduced: true, finishDistance: road.lapLength * 3,
  })
  r.dispose()
}

const SCENIC: Record<string, number> = { 'chennai-city': 0.3, 'temple-hill': 0.27, 'coastal-highway': 0.15, 'forest-road': 0.43, 'village-lane': 0.25, 'night-city': 0.42 }

export function TrackPicker({
  trackId,
  onTrack,
  diffs,
  camera,
  onCamera,
  onStart,
}: {
  trackId: string
  onTrack: (id: string) => void
  diffs: { id: Difficulty; blurb: string }[]
  camera: CameraMode
  onCamera: (c: CameraMode) => void
  onStart: (d: Difficulty) => void
}) {
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const thumbs = useRef<(HTMLCanvasElement | null)[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0]

  // The big background: the selected track.
  useEffect(() => {
    const c = bgRef.current
    if (!c) return
    const id = window.setTimeout(() => renderPreview(c, track, SCENIC[track.id] ?? 0.3), 0)
    return () => window.clearTimeout(id)
  }, [track])

  // Thumbnails, one at a time so the page never stalls.
  useEffect(() => {
    const ids: number[] = []
    TRACKS.forEach((t, i) => {
      ids.push(
        window.setTimeout(() => {
          const c = thumbs.current[i]
          if (c) renderPreview(c, t, SCENIC[t.id] ?? 0.3)
        }, 60 + i * 90)
      )
    })
    return () => ids.forEach((x) => window.clearTimeout(x))
  }, [])

  return (
    <div className="fixed inset-0 overflow-y-auto bg-stone-900" style={{ height: '100dvh' }}>
      <canvas ref={bgRef} className="fixed inset-0 w-full h-full" aria-hidden />
      <div className="relative min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6 bg-gradient-to-t from-stone-900/60 via-stone-900/10 to-transparent">
        <div className="w-full max-w-3xl rounded-3xl bg-white/95 shadow-2xl border border-white p-4 sm:p-6 animate-gamev2-pop-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta-600">Game Room · Racing</p>
              <h1 className="font-tamil text-2xl sm:text-3xl font-black text-stone-900 leading-tight">தமிழ்ப் பந்தயம்</h1>
              <p className="text-sm font-bold text-primary-700">Tamil Grand Prix</p>
            </div>
            <div className="hidden sm:flex items-center gap-1" aria-label="போட்டியாளர்கள் · Rivals">
              {RIVALS.map((r) => (
                <span key={r.id} className="flex flex-col items-center rounded-xl bg-stone-50 border border-stone-200 px-2 py-1" title={r.blurb}>
                  <span className="w-5 h-3 rounded-sm" style={{ background: r.color }} aria-hidden />
                  <span className="font-tamil text-xs font-bold text-stone-700">{r.tamilName}</span>
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            <span className="font-tamil block text-stone-800">
              மூன்று சுற்றுகள் ஓட்டுங்கள். ஒவ்வொரு <b>தமிழ்ச் சாவடி</b>யிலும் பந்தயம் நிற்கும்; சரியான விடைக்கு ஒரு ஆற்றல் கிடைக்கும் -- அதை எப்போது பயன்படுத்துவது என்பது உங்கள் முடிவு!
            </span>
            Three laps. At each Tamil checkpoint the race pauses; a correct answer earns a power-up you fire when you choose.
          </p>

          <h2 className="mt-4 text-sm font-bold text-stone-500">
            <span className="font-tamil">பாதையைத் தேர்ந்தெடுங்கள்</span> · Choose a track
          </h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="பாதை · Track">
            {TRACKS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === trackId}
                onClick={() => onTrack(t.id)}
                className={`text-left rounded-2xl overflow-hidden border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${t.id === trackId ? 'border-primary-600 ring-2 ring-primary-200' : 'border-stone-200 hover:border-primary-300'}`}
              >
                <canvas ref={(el) => { thumbs.current[i] = el }} className="block w-full aspect-[16/9] bg-stone-200" aria-hidden />
                <span className="block px-2 py-1.5">
                  <span className="block font-tamil text-sm font-extrabold text-stone-900 leading-tight">{t.tamilName}</span>
                  <span className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>{t.name}</span>
                    <span aria-label={`கடினம் ${t.challenge}/3`}>{'●'.repeat(t.challenge)}{'○'.repeat(3 - t.challenge)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-600 font-tamil">{track.blurb}</p>

          <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <h2 className="text-sm font-bold text-stone-500">
                <span className="font-tamil">{TA.difficulty.ta}</span> · Difficulty
              </h2>
              <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${TA.difficulty.ta} · Difficulty`}>
                {diffs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`rounded-2xl border-2 px-2 py-2 min-h-[60px] text-center transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${difficulty === d.id ? 'border-primary-600 bg-primary-50' : 'border-stone-200 hover:border-primary-400'}`}
                  >
                    <span className="block font-tamil font-extrabold text-stone-900">{TA[d.id].ta}</span>
                    <span className="block font-tamil text-[11px] text-stone-500 leading-tight">{d.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-500">
                <span className="font-tamil">கேமரா</span> · Camera
              </h2>
              <div className="mt-1 flex gap-2" role="radiogroup" aria-label="கேமரா · Camera">
                {(['chase', 'cockpit'] as CameraMode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={camera === c}
                    onClick={() => onCamera(c)}
                    className={`rounded-2xl border-2 px-3 min-h-[60px] text-center ${camera === c ? 'border-primary-600 bg-primary-50' : 'border-stone-200 hover:border-primary-400'}`}
                  >
                    <FiVideo className="w-4 h-4 mx-auto text-stone-600" aria-hidden />
                    <span className="block font-tamil text-xs font-bold text-stone-800">{c === 'chase' ? 'காருக்குப் பின்' : 'ஓட்டுநர் இருக்கை'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStart(difficulty)}
            className="mt-4 w-full min-h-[56px] rounded-2xl bg-primary-700 hover:bg-primary-800 text-white text-lg font-extrabold shadow-teal inline-flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gold-400"
          >
            <FiFlag className="w-5 h-5" aria-hidden /> <span className="font-tamil">பந்தயத்தைத் தொடங்கு</span> <span className="text-sm opacity-80">· Start race</span>
          </button>
          <p className="mt-2 text-[11px] text-stone-500 text-center">
            W/↑ <span className="font-tamil">முடுக்கு</span> · S/↓ <span className="font-tamil">நிறுத்து</span> · A/D ←→ <span className="font-tamil">திருப்பு</span> · Space <span className="font-tamil">ஆற்றல்</span> · C <span className="font-tamil">கேமரா</span> · Esc <span className="font-tamil">இடைநிறுத்தம்</span>
          </p>
        </div>
      </div>
    </div>
  )
}
