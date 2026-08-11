'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiLogIn } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

// Shared by both the teacher and student "join a class" entry points --
// only the target endpoint differs (each role's own request table +
// approver).
export function JoinClassForm({ endpoint }: { endpoint: '/api/teacher/class-requests' | '/api/student/class-requests' }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    if (!code.trim()) return
    setSending(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send request')

      toast.success(`Request sent for ${data.className} -- waiting for approval.`)
      setCode('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3">
      <h2 className="font-bold text-stone-800 dark:text-stone-100">Join a Class</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">Enter the class code given to you by the school.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. AB3D9F2K"
          maxLength={8}
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-mono tracking-wider uppercase focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
        <Button type="button" variant="primary" icon={<FiLogIn />} disabled={sending} onClick={submit}>
          {sending ? 'Sending...' : 'Join'}
        </Button>
      </div>
    </div>
  )
}
