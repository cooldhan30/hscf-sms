import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteAccount, findProfileByEmailAndRole } from '@/lib/admin-actions'
import { requireString, requireEmail, optionalString } from '@/lib/validation'

// POST /api/admin/students -- create a student profile, with an optional
// login account and an optional parent link (existing parent found by
// email, or a brand new parent account created and linked).
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const firstName = requireString(body.firstName, 'First name', errors)
  const lastName = requireString(body.lastName, 'Last name', errors)
  const dateOfBirth = optionalString(body.dateOfBirth)
  const gradeLevel = optionalString(body.gradeLevel)
  const academicYear = optionalString(body.academicYear) || '2026-2027'

  const createLogin = Boolean(body.createLogin)
  let studentEmail = ''
  if (createLogin) {
    studentEmail = requireEmail(body.studentEmail, 'Student email', errors)
  }

  const wantsParentLink = Boolean(optionalString(body.parentEmail))
  let parentFirstName = ''
  let parentLastName = ''
  let parentEmail = ''
  const parentPhone = optionalString(body.parentPhone)
  if (wantsParentLink) {
    parentFirstName = requireString(body.parentFirstName, 'Parent first name', errors)
    parentLastName = requireString(body.parentLastName, 'Parent last name', errors)
    parentEmail = requireEmail(body.parentEmail, 'Parent email', errors)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()

  // Optional student login
  let studentProfileId: string | null = null
  let studentTempPassword: string | null = null
  if (createLogin) {
    const invited = await inviteAccount({
      email: studentEmail,
      role: 'student',
      firstName,
      lastName,
    })
    if ('error' in invited) {
      return NextResponse.json({ error: `Student account: ${invited.error}` }, { status: 400 })
    }
    studentProfileId = invited.userId
    studentTempPassword = invited.tempPassword
  }

  const { data: student, error: studentError } = await admin
    .from('sms_students')
    .insert([
      {
        profile_id: studentProfileId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        grade_level: gradeLevel,
        academic_year: academicYear,
      },
    ])
    .select()
    .single()

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 400 })
  }

  // Optional parent link (existing parent reused, or a new one created)
  let parentTempPassword: string | null = null
  if (wantsParentLink) {
    const existingProfile = await findProfileByEmailAndRole(parentEmail, 'parent')

    let parentId: string
    if (existingProfile) {
      const { data: existingParent } = await admin
        .from('sms_parents')
        .select('id')
        .eq('profile_id', existingProfile.id)
        .single()

      if (!existingParent) {
        return NextResponse.json(
          { error: 'Found a matching parent account but no parent record -- please contact support.' },
          { status: 500 }
        )
      }
      parentId = existingParent.id

      if (parentPhone) {
        await admin.from('sms_parents').update({ phone: parentPhone }).eq('id', parentId)
      }
    } else {
      const invited = await inviteAccount({
        email: parentEmail,
        role: 'parent',
        firstName: parentFirstName,
        lastName: parentLastName,
      })
      if ('error' in invited) {
        return NextResponse.json(
          { error: `Student created, but parent account failed: ${invited.error}` },
          { status: 400 }
        )
      }
      parentTempPassword = invited.tempPassword

      const { data: newParent, error: parentError } = await admin
        .from('sms_parents')
        .insert([
          {
            profile_id: invited.userId,
            first_name: parentFirstName,
            last_name: parentLastName,
            email: parentEmail,
            phone: parentPhone,
          },
        ])
        .select()
        .single()

      if (parentError) {
        return NextResponse.json(
          { error: `Student created, but parent record failed: ${parentError.message}` },
          { status: 400 }
        )
      }
      parentId = newParent.id
    }

    const { error: linkError } = await admin
      .from('sms_student_parents')
      .insert([{ student_id: student.id, parent_id: parentId }])

    if (linkError) {
      return NextResponse.json(
        { error: `Student and parent created, but linking failed: ${linkError.message}` },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ student, studentTempPassword, parentTempPassword }, { status: 201 })
}
