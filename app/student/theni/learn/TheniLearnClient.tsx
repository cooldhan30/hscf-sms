'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiArrowRight, FiVolume2 } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'

interface TheniWord {
  id: string
  english: string
  tamil: string
  category_id: string
  category: { name_english: string; name_tamil: string; icon: string | null } | null
}

type Phase = 'loading' | 'learn' | 'practice' | 'done' | 'empty' | 'error'

// Theni 1's full loop for one session: Learn (flip through each word
// once, image/audio optional per the data-driven fallback requirement)
// then Practice (multiple-choice: given a Tamil word, pick its English
// meaning -- "picture match" without a real picture, since no word has
// an image_url populated yet; swapping in <img> once images exist is a
// prop away, not a rewrite). Every answer posts to
// /api/student/theni/progress, which is also where XP/streak accrue.
export function TheniLearnClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [words, setWords] = useState<TheniWord[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/student/theni/learn')
      .then((res) => res.json())
      .then((data) => {
        if (!data.words || data.words.length === 0) {
          setPhase('empty')
          return
        }
        setWords(data.words)
        setPhase('learn')
      })
      .catch(() => setPhase('error'))
  }, [])

  const currentCard = words[cardIndex]
  const currentPracticeWord = words[practiceIndex]

  const options = useMemo(() => {
    if (!currentPracticeWord) return []
    const distractors = words
      .filter((w) => w.id !== currentPracticeWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => w.english)
    return [...distractors, currentPracticeWord.english].sort(() => Math.random() - 0.5)
  }, [currentPracticeWord, words])

  function speak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ta-IN'
    window.speechSynthesis.speak(utterance)
  }

  function handleLearnNext() {
    if (cardIndex + 1 < words.length) {
      setCardIndex((i) => i + 1)
    } else {
      setPhase('practice')
    }
  }

  async function handlePracticeAnswer(option: string) {
    if (selected || submitting || !currentPracticeWord) return
    setSelected(option)
    const isCorrect = option === currentPracticeWord.english
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) setCorrectCount((c) => c + 1)

    setSubmitting(true)
    try {
      const res = await fetch('/api/student/theni/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: currentPracticeWord.id, correct: isCorrect }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.xpEarned === 'number') {
        setXpEarned((x) => x + data.xpEarned)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handlePracticeNext() {
    setSelected(null)
    setFeedback(null)
    if (practiceIndex + 1 < words.length) {
      setPracticeIndex((i) => i + 1)
    } else {
      setPhase('done')
    }
  }

  if (phase === 'loading') {
    return <p className="text-center text-stone-400 dark:text-stone-500 py-12">Loading your quest...</p>
  }

  if (phase === 'error') {
    return <EmptyState title="Couldn't load words" description="Please try again in a moment." />
  }

  if (phase === 'empty') {
    return <EmptyState title="No words available right now" description="Check back once your Tamil Theni season has vocabulary loaded." />
  }

  if (phase === 'learn' && currentCard) {
    return (
      <div className="space-y-4">
        <p className="text-center text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase">
          Learn · {cardIndex + 1} / {words.length}
        </p>
        <div className="p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center space-y-4">
          {currentCard.category?.icon && <div className="text-5xl">{currentCard.category.icon}</div>}
          <p className="text-4xl font-bold text-primary-900 dark:text-white">{currentCard.tamil}</p>
          <p className="text-lg text-stone-500 dark:text-stone-400">{currentCard.english}</p>
          <button
            onClick={() => speak(currentCard.tamil)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
          >
            <FiVolume2 className="w-4 h-4" /> Listen
          </button>
        </div>
        <Button variant="primary" fullWidth icon={<FiArrowRight />} onClick={handleLearnNext}>
          Next
        </Button>
      </div>
    )
  }

  if (phase === 'practice' && currentPracticeWord) {
    return (
      <div className="space-y-4">
        <p className="text-center text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase">
          Practice · {practiceIndex + 1} / {words.length}
        </p>
        <div className="p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center space-y-2">
          <p className="text-sm text-stone-500 dark:text-stone-400">What does this word mean?</p>
          <p className="text-4xl font-bold text-primary-900 dark:text-white">{currentPracticeWord.tamil}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((option) => {
            const isSelected = selected === option
            const isCorrectOption = option === currentPracticeWord.english
            const showResult = selected !== null
            return (
              <button
                key={option}
                onClick={() => handlePracticeAnswer(option)}
                disabled={selected !== null}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  showResult && isCorrectOption
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300'
                    : showResult && isSelected
                      ? 'border-terracotta-500 bg-terracotta-50 dark:bg-terracotta-950/40 text-terracotta-800 dark:text-terracotta-300'
                      : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>

        {feedback && (
          <div className="text-center space-y-3">
            <p className={`text-lg font-bold ${feedback === 'correct' ? 'text-primary-700 dark:text-primary-400' : 'text-stone-600 dark:text-stone-300'}`}>
              {feedback === 'correct' ? 'சபாஷ்! 🎉 Excellent!' : `Almost there! It's "${currentPracticeWord.english}".`}
            </p>
            <Button variant="primary" fullWidth icon={<FiArrowRight />} onClick={handlePracticeNext}>
              {practiceIndex + 1 < words.length ? 'Next' : 'Finish'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    const accuracy = words.length > 0 ? Math.round((correctCount / words.length) * 100) : 0
    return (
      <div className="text-center space-y-6 py-8">
        <div className="text-6xl">🏆</div>
        <div>
          <h2 className="text-2xl font-bold text-primary-900 dark:text-white">Mission Complete!</h2>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            {correctCount} / {words.length} correct ({accuracy}%)
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-100 dark:bg-gold-950/40 text-gold-800 dark:text-gold-300 font-semibold">
          ⭐ +{xpEarned} XP
        </div>
        <Button variant="primary" onClick={() => router.push('/student/theni')}>
          Back to Tamil Theni
        </Button>
      </div>
    )
  }

  return null
}
