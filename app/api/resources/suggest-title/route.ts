import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { groqReadImageTitle, GroqVisionRateLimitError } from '@/lib/groq'

// ~1.5 MB of base64; the browser sends a 1024px-wide JPEG (~250 KB)
const MAX_DATA_URL_LENGTH = 2_000_000

// POST /api/resources/suggest-title -- Body: { image: data URL }
// Reads the title printed on an uploaded image (Resources multi-upload).
// Teachers/admins only, so students can't spend the Groq quota. Returns
// { title } (null when there is none), or 429 { retryAfter } when Groq's
// per-minute limit is hit -- the browser waits and sends it again.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createClient()
  const { data: profile } = await supabase.from('sms_profiles').select('role, is_active').eq('id', userId).single()
  if (!profile?.is_active || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Only teachers and admins can upload resources' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const image: unknown = body?.image
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: 'image must be a JPEG, PNG or WebP data URL under 1.5 MB' }, { status: 400 })
  }

  try {
    return NextResponse.json({ title: await groqReadImageTitle(image) })
  } catch (err) {
    if (err instanceof GroqVisionRateLimitError) {
      return NextResponse.json({ retryAfter: err.retryAfterSeconds }, { status: 429 })
    }
    console.error('suggest-title failed', err)
    return NextResponse.json({ title: null })
  }
}
