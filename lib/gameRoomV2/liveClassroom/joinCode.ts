// Normalizes a student-typed join code before it's sent to the server
// -- uppercased (the DB's sms_generate_join_code() alphabet is
// uppercase-only, and the resolve RPC also UPPER()s defensively, but
// normalizing client-side means a lowercase paste doesn't visually look
// "wrong" while the student is still typing) and trims incidental
// whitespace. Does NOT validate length/charset -- an invalid code is
// simply one the resolve RPC won't find a match for, same "let the
// server be the single source of truth for validity" precedent every
// other GameRoom V2 lookup already follows.
//
// Spaces and dashes anywhere are dropped too, so a code shown grouped on
// the teacher's screen ("AB7K 9PQR") works however the student types it.
export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[\s\-\u2010-\u2015]/g, '').toUpperCase()
}
