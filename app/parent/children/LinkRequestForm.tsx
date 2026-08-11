'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSend } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

export function LinkRequestForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function sendRequest() {
    if (!email.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/parent/link-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentEmail: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send request')

      toast.success('Request sent -- waiting for the student to approve.')
      setEmail('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3">
      <h2 className="font-bold text-stone-800 dark:text-stone-100">Request a link to a child</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Enter your child&apos;s student account email. They&apos;ll need to approve the request before you can see
        their data.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
        <Button type="button" variant="primary" icon={<FiSend />} disabled={sending} onClick={sendRequest}>
          {sending ? 'Sending...' : 'Send Request'}
        </Button>
      </div>
    </div>
  )
}
