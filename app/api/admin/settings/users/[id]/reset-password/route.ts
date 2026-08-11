import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { resetUserPassword } from '@/lib/admin-actions'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const result = await resetUserPassword(params.id)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ tempPassword: result.tempPassword })
}
