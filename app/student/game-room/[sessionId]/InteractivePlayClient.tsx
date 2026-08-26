'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInteractiveGameModule } from '@/lib/gameRoom/registry'
import { TamilLetterOrderGame } from '@/components/gameRoom/TamilLetterOrderGame'
import { TamilLetterMemoryGame } from '@/components/gameRoom/TamilLetterMemoryGame'
import { UyirKurilNedilSortGame } from '@/components/gameRoom/UyirKurilNedilSortGame'
import { UyirKurilNedilMemoryGame } from '@/components/gameRoom/UyirKurilNedilMemoryGame'
import { TamilLetterSortGame, type SortCategory } from '@/components/gameRoom/TamilLetterSortGame'
import { TamilPairMatchGame } from '@/components/gameRoom/TamilPairMatchGame'
import { TamilMissingLetterGame } from '@/components/gameRoom/TamilMissingLetterGame'
import { UYIR_EZHUTHUKKAL } from '@/lib/gameRoom/modules/uyirEzhuthukkal/letters'
import { MEI_EZHUTHUKKAL } from '@/lib/gameRoom/modules/meiEzhuthukkal/letters'
import { MEI_VALLINAM_MELLINAM_IDAIYINAM } from '@/lib/gameRoom/modules/meiVallinamMellinamIdaiyinam/letters'
import { INA_EZHUTHUKKAL_PAIRS } from '@/lib/gameRoom/modules/inaEzhuthukkal/letters'
import type { OrderGameData } from '@/lib/gameRoom/modules/tamilLetterGames/orderGame'
import type { MemoryGameData } from '@/lib/gameRoom/modules/tamilLetterGames/memoryGame'
import type { ClassifySortGameData } from '@/lib/gameRoom/modules/tamilLetterGames/classifySortGame'
import type { PairMatchGameData } from '@/lib/gameRoom/modules/tamilLetterGames/pairMatchGame'
import type { MissingLetterGameData } from '@/lib/gameRoom/modules/missingLetterGames/missingLetterGame'
import type { SortGameData } from '@/lib/gameRoom/modules/uyirKurilNedil/sortGame'
import type { KurilNedilMemoryGameData } from '@/lib/gameRoom/modules/uyirKurilNedil/memoryGame'

const MEI_VALLINAM_MELLINAM_IDAIYINAM_CATEGORIES: SortCategory[] = [
  {
    id: 'vallinam',
    label: 'வல்லினம்',
    borderClass: 'border-primary-700 dark:border-primary-400',
    bgClass: 'bg-primary-50 dark:bg-primary-950',
    textClass: 'text-primary-800 dark:text-primary-300',
  },
  {
    id: 'mellinam',
    label: 'மெல்லினம்',
    borderClass: 'border-amber-600 dark:border-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950',
    textClass: 'text-amber-800 dark:text-amber-300',
  },
  {
    id: 'idaiyinam',
    label: 'இடையினம்',
    borderClass: 'border-emerald-700 dark:border-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950',
    textClass: 'text-emerald-800 dark:text-emerald-300',
  },
]

// The canonical letter order for each game id -- the order game needs
// this as its "correct answer" sequence; the memory game only needs
// its length (pairCount). Kept here (not in the registry) since it's
// purely a client-side rendering concern, same as gameModule.instructions.
const LETTER_SETS: Record<string, readonly string[]> = {
  'uyir-order': UYIR_EZHUTHUKKAL,
  'uyir-memory': UYIR_EZHUTHUKKAL,
  'mei-order': MEI_EZHUTHUKKAL,
  'mei-memory': MEI_EZHUTHUKKAL,
}

const COMPLETION_MESSAGES: Record<string, string | ((attempts: number) => string)> = {
  'uyir-order': 'நீங்கள் 12 உயிரெழுத்துகளையும் சரியாக வரிசைப்படுத்திவிட்டீர்கள்!',
  'uyir-memory': (attempts: number) => `12 உயிரெழுத்துகளையும் கண்டுபிடித்துவிட்டீர்கள்! (${attempts} attempts)`,
  'mei-order': 'மிகவும் அருமை! 18 மெய்யெழுத்துகளையும் சரியான வரிசையில் அமைத்துவிட்டீர்கள்!',
  'mei-memory': (attempts: number) => `18 மெய்யெழுத்துகளையும் கண்டுபிடித்துவிட்டீர்கள்! (${attempts} attempts)`,
}

// Board data (shuffled tiles/cards) is generated once by
// /api/game-room/interactive/start and handed straight to the client --
// it is never persisted server-side or re-fetched (see the plan's
// rationale: a solo, non-competitive letter game has no need for the
// quiz engine's poll/re-fetch machinery). GameRoomStudentClient.tsx
// stashes it in sessionStorage right after the start call, keyed by
// sessionId, for this component to read once on mount. A page refresh
// loses this (there is nothing server-side to refetch by design) and
// falls back to the "start again" prompt below.
export function InteractivePlayClient({ sessionId: initialSessionId, gameType }: { sessionId: string; gameType: string }) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [gameData, setGameData] = useState<
    | OrderGameData
    | MemoryGameData
    | SortGameData
    | KurilNedilMemoryGameData
    | ClassifySortGameData
    | PairMatchGameData
    | MissingLetterGameData
    | null
    | undefined
  >(undefined)
  // Bumped on every restart so the game component remounts with fresh
  // internal state (placed tiles, matched pairs, etc.) instead of
  // reusing a stale instance -- neither game resets its own state if its
  // `tiles` prop changes without a key change.
  const [instanceKey, setInstanceKey] = useState(0)

  useEffect(() => {
    const raw = sessionStorage.getItem(`gameRoom:${sessionId}:gameData`)
    setGameData(raw ? JSON.parse(raw) : null)
  }, [sessionId])

  const gameModule = getInteractiveGameModule(gameType)
  const letters = LETTER_SETS[gameType]

  async function handleComplete(sid: string, score: number) {
    await fetch('/api/game-room/interactive/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, score, correctCount: score }),
    })
    sessionStorage.removeItem(`gameRoom:${sid}:gameData`)
  }

  // Replay resets completely without a page refresh (per spec) -- starts
  // a brand-new session+player row (a fresh reshuffled board) rather than
  // reusing the completed one, and swaps the URL to match via
  // router.replace so the address bar/back button stay consistent.
  async function handleRestart() {
    setGameData(undefined)
    const res = await fetch('/api/game-room/interactive/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      setGameData(null)
      return
    }

    sessionStorage.setItem(`gameRoom:${data.sessionId}:gameData`, JSON.stringify(data.gameData))
    sessionStorage.setItem(`gameRoom:${data.sessionId}:gameType`, gameType)
    setSessionId(data.sessionId)
    setGameData(data.gameData)
    setInstanceKey((k) => k + 1)
    router.replace(`/student/game-room/${data.sessionId}`)
  }

  if (gameData === undefined) {
    return <p className="text-center py-16 text-stone-400 dark:text-stone-500">Loading...</p>
  }

  const isCustomBoardGame =
    gameType.startsWith('uyir-kuril-nedil-') ||
    gameType === 'mei-vallinam-mellinam-idaiyinam-sort' ||
    gameType === 'ina-ezhuthukkal-matching' ||
    gameType === 'uyir-missing-letter' ||
    gameType === 'mei-missing-letter'

  if (!gameData || !gameModule || (!letters && !isCustomBoardGame)) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-stone-500 dark:text-stone-400">
          This game session has expired -- start a fresh one from Game Room.
        </p>
      </div>
    )
  }

  if (gameType === 'uyir-kuril-nedil-sort') {
    return (
      <UyirKurilNedilSortGame
        key={instanceKey}
        sessionId={sessionId}
        tiles={(gameData as SortGameData).tiles}
        instructions={gameModule.instructions}
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  if (gameType === 'uyir-kuril-nedil-memory') {
    return (
      <UyirKurilNedilMemoryGame
        key={instanceKey}
        sessionId={sessionId}
        tiles={(gameData as KurilNedilMemoryGameData).tiles}
        instructions={gameModule.instructions}
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  if (gameType === 'mei-vallinam-mellinam-idaiyinam-sort') {
    return (
      <TamilLetterSortGame
        key={instanceKey}
        sessionId={sessionId}
        tiles={(gameData as ClassifySortGameData).tiles}
        items={MEI_VALLINAM_MELLINAM_IDAIYINAM}
        categories={MEI_VALLINAM_MELLINAM_IDAIYINAM_CATEGORIES}
        instructions={gameModule.instructions}
        completionMessage="18 மெய்யெழுத்துகளையும் சரியாக வகைப்படுத்திவிட்டீர்கள்! வல்லினம், மெல்லினம், இடையினம் — மூன்றையும் கண்டுபிடித்துவிட்டீர்கள்!"
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  if (gameType === 'ina-ezhuthukkal-matching') {
    const pairData = gameData as PairMatchGameData
    return (
      <TamilPairMatchGame
        key={instanceKey}
        sessionId={sessionId}
        leftCards={pairData.leftCards}
        rightCards={pairData.rightCards}
        pairs={INA_EZHUTHUKKAL_PAIRS.map((p) => ({ left: p.mei, right: p.ina }))}
        instructions={gameModule.instructions}
        completionMessage="அனைத்து இன எழுத்துகளையும் சரியாக இணைத்துவிட்டீர்கள்!"
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  if (gameType === 'uyir-missing-letter' || gameType === 'mei-missing-letter') {
    const missingData = gameData as MissingLetterGameData
    const completionMessage =
      gameType === 'uyir-missing-letter'
        ? 'உயிரெழுத்துகளை சரியாக நிரப்பிவிட்டீர்கள்!'
        : 'மெய்யெழுத்துகளை சரியாக நிரப்பிவிட்டீர்கள்!'
    return (
      <TamilMissingLetterGame
        key={instanceKey}
        sessionId={sessionId}
        sequence={missingData.sequence}
        sourceLetters={missingData.sourceLetters}
        instructions={gameModule.instructions}
        completionMessage={completionMessage}
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  if (gameType.endsWith('-order')) {
    return (
      <TamilLetterOrderGame
        key={instanceKey}
        sessionId={sessionId}
        tiles={(gameData as OrderGameData).tiles}
        letters={letters}
        instructions={gameModule.instructions}
        completionMessage={COMPLETION_MESSAGES[gameType] as string}
        onComplete={handleComplete}
        onRestart={handleRestart}
      />
    )
  }

  return (
    <TamilLetterMemoryGame
      key={instanceKey}
      sessionId={sessionId}
      tiles={(gameData as MemoryGameData).tiles}
      pairCount={letters.length}
      instructions={gameModule.instructions}
      completionMessage={COMPLETION_MESSAGES[gameType] as (attempts: number) => string}
      onComplete={handleComplete}
      onRestart={handleRestart}
    />
  )
}
