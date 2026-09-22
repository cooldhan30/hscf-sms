'use client'

import { useState } from 'react'
import {
  GameV2Button,
  GameV2Card,
  GameTile,
  GameV2StatusPill,
  AnswerOption,
  type AnswerOptionState,
  QuestionPanel,
  GameV2Timer,
  GameV2XPDisplay,
  GameV2CoinDisplay,
  GameV2ProgressBar,
  PlayerAvatar,
  GameV2Badge,
  GameV2Modal,
  ResultsPanel,
  GameV2Loading,
  GameV2Empty,
  GameV2Error,
} from '@/components/gameRoomV2'
import type { GameEngineStatus } from '@/lib/gameRoomV2/domain'
import type { GameTileAccent } from '@/components/gameRoomV2'

const ENGINE_STATUSES: GameEngineStatus[] = ['COMING_SOON', 'ALPHA', 'BETA', 'ACTIVE', 'DISABLED']
const TILE_ACCENTS: GameTileAccent[] = ['ink', 'coral', 'mint', 'cyan', 'magenta', 'lime']
const ANSWER_STATES: AnswerOptionState[] = ['idle', 'selected', 'correct', 'incorrect', 'dimmed']

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Swatch({ name, classes }: { name: string; classes: string }) {
  return (
    <div className="text-center">
      <div className={`w-full aspect-square rounded-xl ${classes}`} />
      <p className="text-[11px] font-semibold text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">{name}</p>
    </div>
  )
}

export function DesignGalleryClient() {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [xp, setXp] = useState(1240)
  const [coins, setCoins] = useState(86)
  const [gained, setGained] = useState<number | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const [showError, setShowError] = useState(false)

  function simulateReward() {
    setGained(50)
    setXp((v) => v + 50)
    setCoins((v) => v + 10)
    setTimeout(() => setGained(null), 1600)
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-14">
        <header>
          <p className="text-xs font-bold uppercase tracking-wide text-gamev2spark-600 dark:text-gamev2spark-400">
            Internal preview -- not linked from any nav
          </p>
          <h1 className="text-3xl font-black text-gamev2ink-900 dark:text-white mt-1">
            Tamizhi GameRoom V2 Design Gallery
          </h1>
          <p className="text-gamev2ink-500 dark:text-gamev2ink-400 mt-2 max-w-2xl">
            Every reusable visual component and state in the GameRoom V2 design system, for review before any game
            is built on top of it. No production data or gameplay lives on this page.
          </p>
        </header>

        <Section title="Color palette" description="Isolated to GameRoom V2 -- does not affect any other portal.">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            <Swatch name="Ink 700" classes="bg-gamev2ink-700" />
            <Swatch name="Spark 500" classes="bg-gamev2spark-500" />
            <Swatch name="Coral 500" classes="bg-gamev2coral-500" />
            <Swatch name="Mint 500" classes="bg-gamev2mint-500" />
            <Swatch name="Cyan 500" classes="bg-gamev2cyan-500" />
            <Swatch name="Magenta 500" classes="bg-gamev2magenta-500" />
            <Swatch name="Lime 500" classes="bg-gamev2lime-500" />
            <Swatch name="Ink 950" classes="bg-gamev2ink-950" />
          </div>
        </Section>

        <Section title="Typography" description="Tamil text needs generous line-height/letter-spacing to render beautifully.">
          <GameV2Card>
            <p className="text-3xl font-black text-gamev2ink-900 dark:text-white">Aa Bb Cc — Display</p>
            <p className="font-tamil text-3xl font-extrabold text-gamev2ink-900 dark:text-white leading-[1.6] tracking-wide mt-3">
              திணை, பால், எண், காலம், இடம்
            </p>
            <p className="font-tamil text-lg text-gamev2ink-600 dark:text-gamev2ink-300 leading-[1.7] mt-3 max-w-md">
              செவ்வாயில் தமிழ் பள்ளி ஒரு சிறிய பள்ளிக்கூடம் இருந்தது. குழந்தைகள் அனைவரும் மகிழ்ச்சியாகக் கற்றுக்கொண்டனர்.
            </p>
          </GameV2Card>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <GameV2Button variant="primary">Primary</GameV2Button>
            <GameV2Button variant="spark">Spark</GameV2Button>
            <GameV2Button variant="ghost">Ghost</GameV2Button>
            <GameV2Button variant="danger">Danger</GameV2Button>
            <GameV2Button variant="primary" disabled>
              Disabled
            </GameV2Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GameV2Button size="md">Medium</GameV2Button>
            <GameV2Button size="lg">Large</GameV2Button>
            <GameV2Button size="xl">Extra Large</GameV2Button>
          </div>
        </Section>

        <Section title="Game tiles" description="Status communicated by icon + label + color, never color alone.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ENGINE_STATUSES.map((status, i) => (
              <GameTile
                key={status}
                title={status.replace('_', ' ')}
                tamilTitle="வினாடி வினா"
                icon={<span>🎮</span>}
                accent={TILE_ACCENTS[i % TILE_ACCENTS.length]}
                status={status}
                onClick={() => {}}
              />
            ))}
          </div>
        </Section>

        <Section title="Status pills">
          <div className="flex flex-wrap gap-2">
            {ENGINE_STATUSES.map((s) => (
              <GameV2StatusPill key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section title="Question panel + answer states" description="Click an option to see selected/correct/incorrect states.">
          <QuestionPanel category="திணை" prompt="'பையன் ஓடுகிறான்' -- இந்த வாக்கியத்தில் திணை எது?">
            {['விலங்கு', 'மனிதன்', 'பொருள்', 'இடம்'].map((opt) => {
              let state: AnswerOptionState = 'idle'
              if (selectedAnswer === opt) state = opt === 'மனிதன்' ? 'correct' : 'incorrect'
              else if (selectedAnswer && opt === 'மனிதன்') state = 'correct'
              else if (selectedAnswer) state = 'dimmed'
              return (
                <AnswerOption
                  key={opt}
                  label={opt}
                  state={state}
                  disabled={Boolean(selectedAnswer)}
                  onClick={() => setSelectedAnswer(opt)}
                />
              )
            })}
          </QuestionPanel>
          {selectedAnswer && (
            <div className="text-center">
              <GameV2Button variant="ghost" size="md" onClick={() => setSelectedAnswer(null)}>
                Reset
              </GameV2Button>
            </div>
          )}
        </Section>

        <Section title="Answer option states (reference)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {ANSWER_STATES.map((s) => (
              <AnswerOption key={s} label={`${s} state`} state={s} disabled />
            ))}
          </div>
        </Section>

        <Section title="HUD: timer, XP, coins" description="Click 'Simulate reward' to see the gain animation.">
          <div className="flex flex-wrap items-center gap-3">
            <GameV2Timer secondsRemaining={4} totalSeconds={20} />
            <GameV2Timer secondsRemaining={17} totalSeconds={20} />
            <GameV2XPDisplay xp={xp} gained={gained} />
            <GameV2CoinDisplay coins={coins} gained={gained ? gained / 5 : null} />
            <GameV2Button size="md" variant="spark" onClick={simulateReward}>
              Simulate reward
            </GameV2Button>
          </div>
        </Section>

        <Section title="Progress bars">
          <div className="space-y-4 max-w-md">
            <GameV2ProgressBar value={3} max={10} label="Question progress" tone="ink" />
            <GameV2ProgressBar value={7} max={10} label="Level fill" tone="spark" />
            <GameV2ProgressBar value={10} max={10} label="Complete" tone="mint" />
          </div>
        </Section>

        <Section title="Player avatars">
          <div className="flex flex-wrap items-end gap-4">
            <PlayerAvatar name="Aadhithya" size="sm" />
            <PlayerAvatar name="Raaghav" size="md" rank={1} />
            <PlayerAvatar name="Nithila" size="md" rank={2} />
            <PlayerAvatar name="Siddharth" size="lg" rank={3} />
            <PlayerAvatar name="Rishi" size="md" />
          </div>
        </Section>

        <Section title="Badges" description="Locked badges stay visible (desaturated + lock), not hidden.">
          <div className="flex flex-wrap gap-4">
            <GameV2Badge icon="🔥" label="5-day streak" />
            <GameV2Badge icon="⭐" label="Perfect round" />
            <GameV2Badge icon="🏆" label="Top of class" locked />
            <GameV2Badge icon="🎯" label="100 correct" locked />
          </div>
        </Section>

        <Section title="Modal / dialog">
          <GameV2Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </GameV2Button>
          <GameV2Modal open={modalOpen} title="Level Complete!" onClose={() => setModalOpen(false)}>
            <p className="text-gamev2ink-600 dark:text-gamev2ink-300">
              This is the shared V2 modal shell -- focus-trapped, Escape-to-close, same accessibility behavior as
              the main app&apos;s Modal component.
            </p>
            <div className="mt-4">
              <GameV2Button variant="spark" fullWidth onClick={() => setModalOpen(false)}>
                Continue
              </GameV2Button>
            </div>
          </GameV2Modal>
        </Section>

        <Section title="Results panel">
          <ResultsPanel score={870} correctCount={8} totalQuestions={10} rank={2} onPlayAgain={() => {}} onExit={() => {}} />
        </Section>

        <Section title="Loading, empty, and error states">
          <div className="flex flex-wrap gap-3 mb-2">
            <GameV2Button size="md" variant="ghost" onClick={() => setShowLoading((v) => !v)}>
              Toggle loading
            </GameV2Button>
            <GameV2Button size="md" variant="ghost" onClick={() => setShowEmpty((v) => !v)}>
              Toggle empty
            </GameV2Button>
            <GameV2Button size="md" variant="ghost" onClick={() => setShowError((v) => !v)}>
              Toggle error
            </GameV2Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GameV2Card padding="sm">{showLoading ? <GameV2Loading /> : <GameV2Loading label="(click to preview)" />}</GameV2Card>
            <GameV2Card padding="sm">
              {showEmpty ? (
                <GameV2Empty title="No question sets yet" description="Create one to get started." actionLabel="Create" onAction={() => {}} />
              ) : (
                <GameV2Empty title="(click to preview)" />
              )}
            </GameV2Card>
            <GameV2Card padding="sm">
              {showError ? (
                <GameV2Error description="Could not load this game session." onRetry={() => {}} />
              ) : (
                <GameV2Error title="(click to preview)" />
              )}
            </GameV2Card>
          </div>
        </Section>

        <Section
          title="Motion note"
          description="This whole page respects your OS's 'reduce motion' setting -- try enabling it and revisiting the HUD/answer/results sections above."
        >
          <GameV2Card padding="sm">
            <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
              Every animated component here calls <code className="font-mono text-xs">useGameV2Motion()</code>, which
              reads <code className="font-mono text-xs">prefers-reduced-motion</code> via Framer Motion&apos;s{' '}
              <code className="font-mono text-xs">useReducedMotion()</code> and swaps springs/celebrations for
              instant transitions.
            </p>
          </GameV2Card>
        </Section>
      </div>
    </div>
  )
}
