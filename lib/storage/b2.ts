import 'server-only'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const UPLOAD_URL_TTL_SECONDS = 15 * 60

// B2's S3-compatible API, not AWS -- forcePathStyle avoids relying on
// virtual-hosted-style bucket subdomains, which B2 doesn't consistently
// support the way AWS S3 does.
function b2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.B2_ENDPOINT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
  })
}

// Presigned PUT: the browser uploads directly to B2 with this URL, so the
// file's bytes never pass through our own server (see the 4.5MB Vercel
// serverless body-size ceiling this exists to avoid).
export async function getB2UploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(b2Client(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS })
}

// Presigned GET, same TTL as the existing Supabase createSignedUrl calls
// this replaces for 'b2' rows (see app/student/assignments/[id]/page.tsx).
export async function getB2ReadUrl(key: string, ttlSeconds: number): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: key,
  })
  return getSignedUrl(b2Client(), command, { expiresIn: ttlSeconds })
}

// Best-effort: used when an admin deletes a submission or an entire
// assignment's worth of them, so those bytes actually get reclaimed
// instead of leaking on B2 forever once the DB row is gone.
export async function deleteB2Object(key: string): Promise<void> {
  await b2Client().send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET!, Key: key }))
}
