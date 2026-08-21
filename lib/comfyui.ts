import 'server-only'

const CHECKPOINT = 'dreamshaper_8.safetensors'
const IMAGE_WIDTH = 512
const IMAGE_HEIGHT = 768
const SAMPLER = 'dpmpp_2m'
const SCHEDULER = 'karras'
const STEPS = 30
const CFG = 7.5

export class ComfyUIError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'ComfyUIError'
  }
}

function comfyHeaders(): HeadersInit {
  const token = process.env.COMFYUI_AUTH_TOKEN
  if (!token) throw new ComfyUIError('COMFYUI_AUTH_TOKEN is not configured')
  return { 'Content-Type': 'application/json', 'X-Auth-Token': token }
}

function comfyBaseUrl(): string {
  const url = process.env.COMFYUI_URL
  if (!url) throw new ComfyUIError('COMFYUI_URL is not configured')
  return url.replace(/\/$/, '')
}

// Standard txt2img workflow graph (checkpoint -> CLIP encode positive/negative
// -> KSampler -> VAE decode -> SaveImage). Node "9" is the SaveImage node --
// its id is relied on when reading history[promptId].outputs["9"] later, so
// if this graph shape changes, that read needs to change with it.
function buildWorkflow(prompt: string, negativePrompt: string, seed: number): Record<string, unknown> {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: STEPS,
        cfg: CFG,
        sampler_name: SAMPLER,
        scheduler: SCHEDULER,
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: CHECKPOINT },
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, batch_size: 1 },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['4', 1] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['4', 1] },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'story', images: ['8', 0] },
    },
  }
}

export interface ComfyUIImageRef {
  filename: string
  subfolder: string
  type: string
}

// Step 1 of the queue -> poll -> fetch flow: submit the workflow, get back
// a prompt_id to poll for later. Fast call, safe to await directly in a
// route handler (well under any serverless timeout).
export async function queueComfyUIPrompt(prompt: string, negativePrompt: string, seed: number): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${comfyBaseUrl()}/prompt`, {
      method: 'POST',
      headers: comfyHeaders(),
      body: JSON.stringify({ prompt: buildWorkflow(prompt, negativePrompt, seed) }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ComfyUIError('ComfyUI did not respond to the queue request in time')
    }
    throw new ComfyUIError(`Could not reach ComfyUI: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ComfyUIError(`ComfyUI rejected the prompt (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  if (typeof data?.prompt_id !== 'string') {
    throw new ComfyUIError('ComfyUI queue response had no prompt_id')
  }
  return data.prompt_id
}

// Step 2: one history check. Returns null while still queued/running --
// callers poll this from outside (a client-polled status route), never
// loop on it inside a single request, since a single check can itself
// be slow if ComfyUI is under load and this app's serverless functions
// have a hard wall-clock ceiling.
export async function checkComfyUIHistory(promptId: string): Promise<ComfyUIImageRef | null> {
  let res: Response
  try {
    res = await fetch(`${comfyBaseUrl()}/history/${promptId}`, {
      headers: comfyHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ComfyUIError('ComfyUI did not respond to the history check in time')
    }
    throw new ComfyUIError(`Could not reach ComfyUI: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ComfyUIError(`ComfyUI history check failed (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  const entry = data?.[promptId]
  if (!entry) return null // still queued or running

  const images = entry?.outputs?.['9']?.images
  if (!Array.isArray(images) || images.length === 0) {
    throw new ComfyUIError('ComfyUI finished the job but produced no image in the expected output node')
  }

  const image = images[0]
  if (typeof image?.filename !== 'string' || typeof image?.type !== 'string') {
    throw new ComfyUIError('ComfyUI returned a malformed image reference')
  }

  return { filename: image.filename, subfolder: image.subfolder ?? '', type: image.type }
}

// Step 3: fetch the actual PNG bytes for a resolved image reference.
export async function fetchComfyUIImage(ref: ComfyUIImageRef): Promise<Buffer> {
  const params = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder, type: ref.type })

  let res: Response
  try {
    res = await fetch(`${comfyBaseUrl()}/view?${params.toString()}`, {
      headers: comfyHeaders(),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ComfyUIError('Timed out downloading the generated image from ComfyUI')
    }
    throw new ComfyUIError(`Could not reach ComfyUI: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ComfyUIError(`Could not fetch the generated image (${res.status}): ${body || res.statusText}`, res.status)
  }

  return Buffer.from(await res.arrayBuffer())
}
