// Deterministic ids for built-in content. Every built-in question set
// and question has a FIXED uuid derived from its content key, so:
//   - syncing the catalog into sms_gamev2_question_sets/_questions is an
//     idempotent upsert (no duplicates, no churn across deploys);
//   - "is this a built-in set?" is answered by membership in the code
//     catalog, never by a column/tag a teacher could set on their own set;
//   - a session's question_order (uuid[]) stays valid across re-syncs.
//
// Pure TS SHA-1 (no node:crypto) so the catalog can be imported by
// verifier scripts, server code and -- if ever needed -- client code.

function sha1Bytes(message: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(message))
  const bitLength = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLength >>> (i * 8)) & 0xff)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const w = new Array<number>(80)

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[chunk + i * 4] << 24) | (bytes[chunk + i * 4 + 1] << 16) | (bytes[chunk + i * 4 + 2] << 8) | bytes[chunk + i * 4 + 3]
    }
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
      w[i] = (x << 1) | (x >>> 31)
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = temp
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
  }

  const out: number[] = []
  for (const h of [h0, h1, h2, h3, h4]) out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff)
  return out
}

export function sha1Hex(message: string): string {
  return sha1Bytes(message)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Fixed namespace so ids never collide with anything uuid_generate_v4()
// could produce in practice, and never change between releases.
const NAMESPACE = 'tamizhi-gameroom-v2-builtin'

// RFC 4122 version-5-shaped uuid (name-based, SHA-1).
export function builtinUuid(name: string): string {
  const bytes = sha1Bytes(`${NAMESPACE}:${name}`).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// Small deterministic integer from a string -- used to place the correct
// answer at a stable-but-varied option index, so the answer isn't always
// first (engines may or may not shuffle options themselves).
export function stableIndex(key: string, modulo: number): number {
  const bytes = sha1Bytes(key)
  return ((bytes[0] << 8) | bytes[1]) % modulo
}
