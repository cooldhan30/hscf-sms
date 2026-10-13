'use client'

import { ButtonLink, Card, Shell } from './ui'

export function TeachersOnly({ message }: { message: string }) {
  return (
    <Shell width="max-w-xl">
      <Card className="mt-6 p-8 text-center">
        <p className="text-5xl" aria-hidden>
          🍎
        </p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">This page is for teachers</h1>
        <p className="mt-2 font-semibold text-slate-600">{message}</p>
        <ButtonLink href="/gr-classic" tone="plain" className="mt-6">
          Back to GameRoom Classic
        </ButtonLink>
      </Card>
    </Shell>
  )
}
