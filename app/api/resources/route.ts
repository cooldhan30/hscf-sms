import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { requireString, optionalString } from '@/lib/validation'
import { validateResourceTaxonomy } from '@/lib/validateResourceTaxonomy'

// GET /api/resources -- list resources, every authenticated role can
// read (RLS: "resources: authenticated read"). ?classId= filters to one
// class; omitted or 'all' returns everything (including class-less
// "visible to everyone" resources either way, since those aren't tied to
// any one class's filter).
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')

  let query = supabase
    .from('sms_resources')
    .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  if (classId && classId !== 'all') {
    query = query.eq('class_id', classId)
  }

  const { data: resources, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ resources })
}

// POST /api/resources -- create a resource row. The file itself is
// already uploaded to the 'resources' Storage bucket via
// /api/storage/upload-url before this is called (same split as
// assignment images / submissions). Teacher or admin only; RLS
// ("resources: teacher insert") is the real enforcement for teachers --
// admin bypasses it via "resources: admin all".
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient()
  const { data: profile } = await supabase.from('sms_profiles').select('id, role, is_active').eq('id', userId).single()
  if (!profile || !profile.is_active || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Teacher or admin access required' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const title = requireString(body.title, 'Title', errors)
  const fileUrl = requireString(body.fileUrl, 'File', errors)
  const description = optionalString(body.description)
  const fileType = optionalString(body.fileType)
  const classId = optionalString(body.classId)
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : null
  const taxonomy = validateResourceTaxonomy(body, errors)

  // A link resource (fileType 'youtube'/'link') has no upload step to
  // validate the URL for -- the teacher typed it directly, so it's
  // checked here instead of trusting an arbitrary string as a clickable
  // link shown to every student.
  if ((fileType === 'youtube' || fileType === 'link') && fileUrl) {
    try {
      const parsed = new URL(fileUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('Link must be a valid http(s) URL')
      }
    } catch {
      errors.push('Link must be a valid URL')
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: resource, error } = await supabase
    .from('sms_resources')
    .insert([
      {
        class_id: classId,
        title,
        description,
        file_url: fileUrl,
        file_type: fileType,
        file_size: fileSize,
        created_by: profile.id,
        ...taxonomy,
      },
    ])
    .select('*, class:sms_classes(id, name), uploader:sms_profiles(first_name, last_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ resource }, { status: 201 })
}
