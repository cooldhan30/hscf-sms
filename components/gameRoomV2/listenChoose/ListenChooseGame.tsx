'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FiVolume2 } from 'react-icons/fi'
import { KidsChoiceGame, FitLabel, LABEL_SIZE, type StageProps } from '@/components/gameRoomV2/kids'
import { labelSizeStep, KID_COLORS, type ChoiceOption } from '@/lib/gameRoomV2/kids'

// Listen & Choose (கேட்டுத் தேர்ந்தெடு) -- Little Learners, ages 4-9. The
// right answer is played out loud (the teacher's clip for a listening
// question, otherwise spoken in Tamil by Sarvam on the server -- see
// app/api/gameroom-v2/sessions/[id]/listen) and the child taps what they
// heard. The answer's text never reaches the browser; only its sound.
// If the sound can't be loaded, the question is shown as text instead so
// the game never gets stuck. Grading stays on the server.

const MUSIC = 'bg-gradient-to-b from-violet-200 via-fuchsia-50 to-sky-100'

export function ListenChooseGame(props: { sessionId: string; onExit: () => void; onPlayAgain?: () => void; onHome?: () => void }) {
  const [soundFailed, setSoundFailed] = useState(false)
  return (
    <KidsChoiceGame
      {...props}
      background={MUSIC}
      resultBackground="bg-gradient-to-b from-violet-200 to-sky-100"
      scenery={(reduced) => <Notes reduced={reduced} />}
      startArt={
        <div className="flex items-center gap-2">
          <span className="w-16 h-16 rounded-full bg-violet-500 text-white flex items-center justify-center shadow-lg">
            <FiVolume2 className="w-8 h-8" />
          </span>
          <span className="text-5xl">👂</span>
        </div>
      }
      titleTa="கேட்டுத் தேர்ந்தெடு!"
      titleEn="Listen & Choose"
      howTa="கவனமாகக் கேள், கேட்டதைத் தொடு!"
      howEn="Listen carefully, then tap what you heard!"
      loadingLabel="ஒலி தயாராகிறது... · Getting the sounds ready..."
      resultLine={(n) => `${n} ஒலிகளைச் சரியாகக் கண்டுபிடித்தாய் · You found ${n} sounds right`}
      gridLabel="விடைகள் · Answers"
      targetWidth="clamp(110px, 17vw, 180px)"
      phoneTargetWidth="38vw"
      questionContent={(q) =>
        soundFailed ? undefined : (
          <span>
            கேட்டு, சரியானதைத் தொடு
            <span className="block text-base sm:text-lg font-semibold text-slate-500">Listen, then tap what you heard</span>
            <span className="sr-only">{q.prompt}</span>
          </span>
        )
      }
      renderTarget={(o, i, state) => <NoteBubble o={o} i={i} state={state} />}
      stage={(p) => <Speaker {...p} onFailed={setSoundFailed} />}
      stagePosition="above"
    />
  )
}

function NoteBubble({ o, i, state }: { o: ChoiceOption; i: number; state: string }) {
  const [fill, dark] = KID_COLORS[(i + 1) % KID_COLORS.length]
  return (
    <span
      className={`relative flex items-center justify-center w-full aspect-square rounded-full transition-all duration-500 ${state === 'chosen' ? 'scale-110' : ''} ${
        state === 'reveal' || state === 'chosen' ? 'ring-4 ring-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.9)]' : ''
      }`}
      style={{ background: `radial-gradient(circle at 35% 30%, #ffffff66, ${fill} 55%, ${dark})`, boxShadow: state === 'idle' || state === 'wrong' ? `0 7px 0 ${dark}` : undefined }}
    >
      <span className="absolute -top-2 -right-1 text-xl sm:text-2xl" aria-hidden>
        ♪
      </span>
      <span className="w-[74%] h-[62%] rounded-full bg-white/90 flex items-center justify-center px-1">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- question-set image, arbitrary Storage URL
          <img src={o.imageUrl} alt={o.label} className="h-[92%] aspect-square object-cover rounded-full" draggable={false} />
        ) : (
          <FitLabel className={`font-tamil font-extrabold text-violet-950 leading-tight ${LABEL_SIZE[labelSizeStep(o.label)]}`}>{o.label}</FitLabel>
        )}
      </span>
    </span>
  )
}

// The big speaker: fetches this question's sound once, plays it when the
// question appears, and again on every tap.
function Speaker({ sessionId, index, soundEnabled, reduced, onFailed }: StageProps & { onFailed: (failed: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'playing' | 'failed'>('loading')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = 0
    a.play()
      .then(() => setState('playing'))
      .catch(() => setState('ready'))
  }, [])

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setUrl(null)
    onFailed(false)
    fetch(`/api/gameroom-v2/sessions/${sessionId}/listen`, { method: 'POST' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return
        if (!ok || typeof d?.url !== 'string') throw new Error(d?.error)
        setUrl(d.url)
      })
      .catch(() => {
        if (cancelled) return
        setState('failed')
        onFailed(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, index])

  // Play as soon as the sound is ready (the Start tap already allowed audio)
  useEffect(() => {
    if (!url || !audioRef.current) return
    setState('ready')
    if (soundEnabled) play()
  }, [url, soundEnabled, play])

  if (state === 'failed') {
    return <p className="font-tamil text-sm font-semibold text-violet-900/70 text-center">ஒலி கிடைக்கவில்லை - கேள்வியைப் படி · Sound not available -- read the question instead</p>
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {url && <audio ref={audioRef} src={url} preload="auto" onEnded={() => setState('ready')} />}
      <button
        type="button"
        onClick={play}
        disabled={state === 'loading'}
        aria-label="மீண்டும் கேள் · Listen again"
        className={`relative w-[clamp(80px,14vw,120px)] aspect-square rounded-full bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-[0_6px_0_#4c1d95] flex items-center justify-center active:translate-y-1 active:shadow-none disabled:opacity-60 ${
          state === 'playing' && !reduced ? 'animate-pulse' : ''
        }`}
      >
        {state === 'playing' && !reduced && <span className="absolute inset-0 rounded-full border-4 border-violet-300 animate-ping" aria-hidden />}
        <FiVolume2 className="w-1/2 h-1/2" />
      </button>
      <span className="font-tamil text-sm font-bold text-violet-900">{state === 'loading' ? 'தயாராகிறது... · Loading...' : 'மீண்டும் கேள் · Tap to hear again'}</span>
    </div>
  )
}

function Notes({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {['♪', '♫', '♬', '♩', '♪', '♫'].map((n, i) => (
        <span
          key={i}
          className={`absolute text-4xl sm:text-5xl text-violet-400/40 ${reduced ? '' : 'animate-[note-float_9s_ease-in-out_infinite]'}`}
          style={{ left: `${6 + i * 16}%`, top: `${22 + (i % 3) * 22}%`, animationDelay: `${-i * 1.5}s` }}
        >
          {n}
        </span>
      ))}
      <style>{`@keyframes note-float { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-24px) rotate(6deg) } }`}</style>
    </div>
  )
}
