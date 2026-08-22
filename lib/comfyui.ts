import 'server-only'

const CHECKPOINT = 'dreamshaper_8.safetensors'
const IMAGE_WIDTH = 512
const IMAGE_HEIGHT = 768
// LCM-LoRA: 6 steps / cfg 1.5 with the "lcm" sampler + "sgm_uniform"
// scheduler produces comparable quality to the previous 30-step
// dpmpp_2m/karras config in ~7-8s instead of ~35s once the model is
// already resident in VRAM (confirmed directly against the live
// instance) -- a cold start right after a container restart will be a
// few seconds slower while the checkpoint+LoRA load, which is expected.
const LORA_NAME = 'lcm_lora_sd15.safetensors'
const LORA_STRENGTH_MODEL = 1.0
const LORA_STRENGTH_CLIP = 1.0
const SAMPLER = 'lcm'
const SCHEDULER = 'sgm_uniform'
const STEPS = 6
const CFG = 1.5

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

// txt2img workflow graph: checkpoint -> LoraLoader (LCM-LoRA) -> CLIP
// encode positive/negative -> KSampler -> VAE decode -> SaveImage. Node
// "9" is the SaveImage node -- its id is relied on when reading
// history[promptId].outputs["9"] later, so if this graph shape changes,
// that read needs to change with it. Node "10" is the LoraLoader --
// model/clip for everything downstream of the checkpoint now flow
// through it rather than straight from CheckpointLoaderSimple, since
// applying the LoRA is what makes the low-step/low-cfg LCM sampling
// actually converge to a good image instead of a noisy one.
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
        model: ['10', 0],
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
      inputs: { text: prompt, clip: ['10', 1] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ['10', 1] },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'story', images: ['8', 0] },
    },
    '10': {
      class_type: 'LoraLoader',
      inputs: {
        lora_name: LORA_NAME,
        strength_model: LORA_STRENGTH_MODEL,
        strength_clip: LORA_STRENGTH_CLIP,
        model: ['4', 0],
        clip: ['4', 1],
      },
    },
  }
}

export interface ComfyUIImageRef {
  filename: string
  subfolder: string
  type: string
}

export interface ComfyUIQueueInfo {
  // Total jobs ComfyUI is currently running + waiting on, across every
  // caller -- this GPU has no concept of "our app's jobs" vs anyone
  // else's, so this is a global depth, not scoped to this app.
  totalDepth: number
  // 1-based position of a specific prompt_id within that combined
  // running+pending order (1 = currently executing), or null if the job
  // isn't in the queue at all (already finished, since /queue only lists
  // running+pending, or promptId simply doesn't exist).
  position: number | null
}

// GET /queue -- ComfyUI returns { queue_running: [...], queue_pending: [...] },
// each entry shaped [number, prompt_id, workflow, extra, outputs]. Position
// is computed by index in running-then-pending order, since that's the
// actual execution order this single-GPU instance processes jobs in.
export async function getComfyUIQueueInfo(promptId?: string): Promise<ComfyUIQueueInfo> {
  let res: Response
  try {
    res = await fetch(`${comfyBaseUrl()}/queue`, {
      headers: comfyHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ComfyUIError('ComfyUI did not respond to the queue check in time')
    }
    throw new ComfyUIError(`Could not reach ComfyUI: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ComfyUIError(`ComfyUI queue check failed (${res.status}): ${body || res.statusText}`, res.status)
  }

  const data = await res.json()
  const running: unknown[] = Array.isArray(data?.queue_running) ? data.queue_running : []
  const pending: unknown[] = Array.isArray(data?.queue_pending) ? data.queue_pending : []
  const combined = [...running, ...pending]

  let position: number | null = null
  if (promptId) {
    const index = combined.findIndex((entry) => Array.isArray(entry) && entry[1] === promptId)
    position = index === -1 ? null : index + 1
  }

  return { totalDepth: combined.length, position }
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
