import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { checkComfyUIHistory, fetchComfyUIImage, getComfyUIQueueInfo, ComfyUIError } from '@/lib/comfyui'
import { uploadB2Object, getB2ReadUrl } from '@/lib/storage/b2'

const READ_URL_TTL_SECONDS = 60 * 60

// GET /api/story-image/status?promptId=... -- one poll of the job
// started by POST /api/story-image/generate. Each call does at most one
// fast history check against ComfyUI; only once the job is actually
// finished does this call also do the (equally fast) fetch-and-upload
// step, so no single request ever waits out the full 30-50s generation
// time itself -- the client is what waits, by polling repeatedly.
//
// Images land in the same B2 bucket used for submissions, under a
// story-images/ prefix -- a separate namespace, not a separate bucket,
// since these are meant to be viewable in a story UI rather than kept
// private the way student submissions are.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { searchParams } = new URL(request.url)
  const promptId = searchParams.get('promptId')
  if (!promptId) {
    return NextResponse.json({ error: 'promptId is required' }, { status: 400 })
  }

  try {
    const imageRef = await checkComfyUIHistory(promptId)
    if (!imageRef) {
      // Still queued or running -- surface where in line this job is so
      // the frontend can show "3rd in queue" instead of a flat time
      // estimate regardless of how busy the single GPU actually is.
      // Best-effort: a queue-check failure shouldn't turn a still-pending
      // job into a reported error, so this falls back to "pending" with
      // no position rather than failing the whole poll.
      const queueInfo = await getComfyUIQueueInfo(promptId).catch(() => ({ position: null, totalDepth: 0 }))
      return NextResponse.json({ status: 'pending', position: queueInfo.position })
    }

    const bytes = await fetchComfyUIImage(imageRef)
    const key = `story-images/${guard.profile.id}/${promptId}.png`
    await uploadB2Object(key, bytes, 'image/png')
    const url = await getB2ReadUrl(key, READ_URL_TTL_SECONDS)

    return NextResponse.json({ status: 'done', key, url })
  } catch (err) {
    if (err instanceof ComfyUIError) {
      return NextResponse.json({ status: 'error', error: err.message }, { status: 502 })
    }
    return NextResponse.json({ status: 'error', error: 'Failed to check image generation status' }, { status: 500 })
  }
}
