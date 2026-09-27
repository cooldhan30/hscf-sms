import { ROAD_WIDTH, SEGMENT_LENGTH, heightAt, type Road } from './road'

// Camera and projection for the pseudo-3D road -- pure maths, no canvas,
// so the renderer and the headless stability tests share one code path.
//
// The road ahead is described in the camera's road frame: the camera sits
// on the road's tangent line, and each point k ahead (the start of a road
// segment) is offset sideways by the bend accumulated since the camera.
// The offset is integrated EXACTLY from the camera's position (a parabola
// inside each segment), so as the camera moves nothing jumps when it
// crosses from one segment to the next.
//
// Conventions: x > 0 is to the right; curve > 0 bends right; yaw > 0 turns
// the view to the right. World units: the road's half-width is ROAD_WIDTH.

export const DRAW_DISTANCE = 220 // segments of road drawn ahead
// Roadside scenery is drawn out to here, fading in smoothly over the last
// stretch (so nothing ever pops in), which also keeps the far distance --
// hundreds of specks -- cheap to draw.
export const SCENERY_DISTANCE = 176
export const SCENERY_FADE_FROM = 130
export const NEAR = 40 // nothing closer than this (world units) is drawn
const BASE_FOV = 100

export type CameraMode = 'chase' | 'cockpit'

export interface Rig {
  depth: number // focal length (1 / tan(fov/2))
  height: number // camera height above the road
  offset: number // camera distance behind the car
}

export function rig(mode: CameraMode, fovDeg = BASE_FOV): Rig {
  const base = 1 / Math.tan((BASE_FOV / 2) * (Math.PI / 180))
  // Chase: high and far enough back that the car sits in the lower third
  // and the road beyond it stays in view. The offset uses the base focal
  // length, so a boost's wider field of view never moves the camera.
  const height = mode === 'cockpit' ? 520 : 1150
  return { depth: 1 / Math.tan((fovDeg / 2) * (Math.PI / 180)), height, offset: mode === 'cockpit' ? 60 : 1650 * base }
}

// ---------------------------------------------------------------------------
// Camera controller: smooth follow of the car's heading, plus a look-ahead
// that turns the view slightly INTO the coming bend (more at speed) so the
// road ahead stays in view. Exponential smoothing on real frame time --
// the same motion at 30, 60 or 144 Hz.

export const CAMERA = {
  follow: 0.5, // share of the car's heading the camera turns with
  look: 0.45, // share of the direction to the look-ahead point
  lookBase: 10, // look-ahead distance in segments at rest...
  lookSpeed: 20, // ...plus this many at full speed
  tauFollow: 0.14, // s
  tauLook: 0.3, // s
  maxYaw: 0.34, // rad (~20 deg): never enough to lose the horizon
  fovBoost: 12, // extra degrees while boosting
  tauFov: 0.35,
}

export interface CameraState {
  follow: number
  look: number
  fov: number
  // Total bend travelled (rad) -- scrolls the sky and horizon.
  heading: number
  lastZ: number | null
}

export function newCamera(): CameraState {
  return { follow: 0, look: 0, fov: BASE_FOV, heading: 0, lastZ: null }
}

export const cameraYaw = (c: CameraState) => Math.max(-CAMERA.maxYaw, Math.min(CAMERA.maxYaw, c.follow + c.look))

// Sideways offset of the road centre `ahead` world units from `z` (in the
// frame of the road's direction at z): the double integral of curvature.
export function roadOffsetAhead(road: Road, z: number, ahead: number): number {
  const segs = road.segments
  const n = segs.length
  const pos = z / SEGMENT_LENGTH
  let idx = Math.floor(pos)
  let f = pos - idx
  let x = 0
  let t = 0 // slope, in "world units per segment"
  let left = ahead / SEGMENT_LENGTH
  while (left > 1e-9) {
    const c = segs[((idx % n) + n) % n].curve
    const step = Math.min(1 - f, left)
    x += t * step + (c * step * step) / 2
    t += c * step
    left -= step
    f = 0
    idx++
  }
  return x
}

// Road direction change over the next `ahead` world units (rad).
export function headingAhead(road: Road, z: number, ahead: number): number {
  const segs = road.segments
  const n = segs.length
  const pos = z / SEGMENT_LENGTH
  let idx = Math.floor(pos)
  let f = pos - idx
  let t = 0
  let left = ahead / SEGMENT_LENGTH
  while (left > 1e-9) {
    const step = Math.min(1 - f, left)
    t += segs[((idx % n) + n) % n].curve * step
    left -= step
    f = 0
    idx++
  }
  return t / SEGMENT_LENGTH
}

export function updateCamera(c: CameraState, road: Road, carZ: number, carYaw: number, speedPct: number, boost: boolean, reduced: boolean, dt: number) {
  const k = (tau: number) => 1 - Math.pow(Math.E, -Math.max(0, dt) / tau)
  // Follow the car's heading (relative to the road).
  c.follow += (CAMERA.follow * carYaw - c.follow) * k(CAMERA.tauFollow)
  // Look towards the road a little way ahead.
  const d = (CAMERA.lookBase + CAMERA.lookSpeed * Math.min(1.3, Math.max(0, speedPct))) * SEGMENT_LENGTH
  const lookTarget = CAMERA.look * Math.atan2(roadOffsetAhead(road, carZ, d), d)
  c.look += (lookTarget - c.look) * k(CAMERA.tauLook)
  const fovTarget = BASE_FOV + (boost && !reduced ? CAMERA.fovBoost : 0)
  c.fov += (fovTarget - c.fov) * k(CAMERA.tauFov)
  // Sky: accumulate the road's turning as the car travels.
  if (c.lastZ !== null) {
    const moved = carZ - c.lastZ
    // (A jump -- a new race, a recovery -- leaves the sky where it is.)
    if (moved > 0 && moved < SEGMENT_LENGTH * 40) c.heading += headingAhead(road, c.lastZ, moved)
  }
  c.lastZ = carZ
}

// ---------------------------------------------------------------------------
// Projection of the road ahead for one frame, into preallocated arrays.
// Point k is the START of the k-th segment from the camera's segment;
// segment k runs from point k to point k+1.

export class RoadFrame {
  readonly size = DRAW_DISTANCE + 1
  count = 0 // number of valid points (0..count-1)
  baseAbs = 0 // absolute segment number of point 0 (laps included)
  position = 0 // absolute race distance of the camera
  n = 0 // segments per lap
  seg = new Int32Array(this.size) // road segment index of point k
  cz = new Float64Array(this.size) // distance ahead of the camera
  rx = new Float64Array(this.size) // road-centre offset (world)
  rt = new Float64Array(this.size) // road slope at the point
  ry = new Float64Array(this.size) // road height (world)
  scale = new Float64Array(this.size)
  sx = new Float64Array(this.size) // screen x of the road centre
  sy = new Float64Array(this.size) // screen y
  sw = new Float64Array(this.size) // screen half-width of the road
  // Camera (world): lateral position in the road frame, height, yaw.
  camX = 0
  camY = 0
  yaw = 0
  depth = 1
  w = 0
  h = 0
}

export function projectRoad(road: Road, carZ: number, carX: number, yaw: number, r: Rig, w: number, h: number, f: RoadFrame): RoadFrame {
  const segs = road.segments
  const n = segs.length
  const position = carZ - r.offset
  const baseAbs = Math.floor(position / SEGMENT_LENGTH)
  const pct = position / SEGMENT_LENGTH - baseAbs
  f.baseAbs = baseAbs
  f.position = position
  f.n = n
  f.depth = r.depth
  f.w = w
  f.h = h
  f.yaw = yaw
  const segOf = (abs: number) => ((abs % n) + n) % n
  // Road centre line relative to the tangent at the camera.
  const cb = segs[segOf(baseAbs)].curve
  let x = (cb * pct * pct) / 2
  let t = -cb * pct
  const count = f.size
  for (let k = 0; k < count; k++) {
    const si = segOf(baseAbs + k)
    f.seg[k] = si
    f.cz[k] = (k - pct) * SEGMENT_LENGTH
    f.rx[k] = x
    f.rt[k] = t
    f.ry[k] = segs[si].y1
    const c = segs[si].curve
    x += t + c / 2
    t += c
  }
  f.count = count
  // The camera sits behind the car along the view direction, so the car
  // is always in the middle of the screen.
  const carRoadX = roadXAt(f, r.offset)
  f.camX = carRoadX + carX * ROAD_WIDTH - yaw * r.offset
  f.camY = heightAt(road, carZ) + r.height
  for (let k = 0; k < count; k++) {
    const cz = f.cz[k]
    const s = cz > NEAR ? r.depth / cz : 0
    f.scale[k] = s
    f.sx[k] = w / 2 + (s * (f.rx[k] - f.camX) - (s > 0 ? r.depth * yaw : 0)) * (w / 2)
    f.sy[k] = h / 2 - s * (f.ry[k] - f.camY) * (h / 2)
    f.sw[k] = s * ROAD_WIDTH * (w / 2)
  }
  return f
}

// Road-centre offset at a distance `d` ahead of the camera (exact parabola).
export function roadXAt(f: RoadFrame, d: number): number {
  const k = Math.max(0, Math.min(f.count - 2, Math.floor((d - f.cz[0]) / SEGMENT_LENGTH)))
  const u = (d - f.cz[k]) / SEGMENT_LENGTH
  const c = f.rt[k + 1] - f.rt[k]
  return f.rx[k] + f.rt[k] * u + (c * u * u) / 2
}

export interface Placed {
  x: number // screen x of the anchor
  y: number // screen y of the ground under it
  scale: number // depth / distance
  cz: number
}

// Screen position of something `d` world units ahead of the camera at
// lateral offset `off` (road half-widths). Returns false if behind the
// near plane or beyond the frame.
export function placeAt(f: RoadFrame, d: number, off: number, out: Placed): boolean {
  if (d <= NEAR) return false
  const k = Math.floor((d - f.cz[0]) / SEGMENT_LENGTH)
  if (k < 0 || k >= f.count - 1) return false
  const u = (d - f.cz[k]) / SEGMENT_LENGTH
  const c = f.rt[k + 1] - f.rt[k]
  const rx = f.rx[k] + f.rt[k] * u + (c * u * u) / 2
  const ry = f.ry[k] + (f.ry[k + 1] - f.ry[k]) * u
  const s = f.depth / d
  out.scale = s
  out.cz = d
  out.x = f.w / 2 + (s * (rx + off * ROAD_WIDTH - f.camX) - f.depth * f.yaw) * (f.w / 2)
  out.y = f.h / 2 - s * (ry - f.camY) * (f.h / 2)
  return true
}

// Distance ahead of the camera of an absolute race distance.
export const aheadOf = (f: RoadFrame, z: number) => z - f.position
