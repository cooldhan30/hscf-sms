import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'
import { queueComfyUIPrompt, getComfyUIQueueInfo, ComfyUIError } from '@/lib/comfyui'

// Kept out of the prompt UI on purpose -- always applied, not
// teacher-editable, so every generated illustration stays usable in a
// classroom context regardless of what the story prompt itself asked for.
const DEFAULT_NEGATIVE_PROMPT =
  'nsfw, nudity, violence, gore, blood, weapons, scary, disturbing, text, watermark, signature, low quality, blurry, deformed'

// Single GTX 1060, one job at a time, ~35-45s each -- a queue of 4
// already means a ~2-3 minute wait for whoever's last in line. Beyond
// that, new requests are rejected outright rather than piling up
// indefinitely and silently getting slower for everyone already waiting.
const MAX_QUEUE_DEPTH = 4

// POST /api/story-image/generate -- teacher-only. Queues a ComfyUI
// txt2img job and returns immediately with a promptId; the actual
// 30-50s generation happens on the home-server GPU while the client
// polls GET /api/story-image/status?promptId=... every few seconds
// (see lib/comfyui.ts -- a single blocking request here would risk
// Vercel's serverless function timeout).
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const prompt = requireString(body.prompt, 'Prompt', errors)
  const extraNegative = optionalString(body.negativePrompt)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const negativePrompt = extraNegative ? `${DEFAULT_NEGATIVE_PROMPT}, ${extraNegative}` : DEFAULT_NEGATIVE_PROMPT
  const seed = typeof body.seed === 'number' ? body.seed : Math.floor(Math.random() * 2 ** 32)

  try {
    const { totalDepth } = await getComfyUIQueueInfo()
    if (totalDepth >= MAX_QUEUE_DEPTH) {
      return NextResponse.json(
        { error: 'Illustration generation is busy right now -- please try again in a few minutes.' },
        { status: 503 }
      )
    }

    const promptId = await queueComfyUIPrompt(prompt, negativePrompt, seed)
    return NextResponse.json({ promptId }, { status: 202 })
  } catch (err) {
    if (err instanceof ComfyUIError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to queue image generation' }, { status: 500 })
  }
}
