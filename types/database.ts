export type SmsRole = 'admin' | 'teacher' | 'student' | 'parent' | 'pending'

export interface SmsProfile {
  id: string
  role: SmsRole
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  avatar_url: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface SmsTeacher {
  id: string
  profile_id: string
  employee_id: string | null
  subject_specialty: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface SmsStudent {
  id: string
  profile_id: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  grade_level: string | null
  enrollment_status: 'active' | 'inactive' | 'graduated' | 'withdrawn'
  academic_year: string
  source_registration_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface SmsParent {
  id: string
  profile_id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface SmsStudentParent {
  student_id: string
  parent_id: string
  relationship: string | null
}

export type SmsParentLinkRequestStatus = 'pending' | 'approved' | 'denied'

export interface SmsParentLinkRequest {
  id: string
  parent_id: string
  student_id: string
  status: SmsParentLinkRequestStatus
  requested_at: string
  resolved_at: string | null
}

export interface SmsConversation {
  id: string
  user_a: string
  user_b: string
  last_message_at: string | null
  created_at: string
}

export interface SmsMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  attachment_url: string | null
  created_at: string
  read_at: string | null
}

export interface SmsChatContact {
  profile_id: string
  first_name: string
  last_name: string
  role: SmsRole
}

export interface SmsClass {
  id: string
  name: string
  grade_level: string | null
  teacher_id: string | null
  schedule_day: string | null
  start_time: string | null
  end_time: string | null
  room: string | null
  academic_year: string
  join_code: string | null
  created_at: string
  updated_at: string
}

export type SmsClassRequestStatus = 'pending' | 'approved' | 'denied'

export interface SmsClassTeacherRequest {
  id: string
  class_id: string
  teacher_id: string
  status: SmsClassRequestStatus
  requested_at: string
  resolved_at: string | null
}

export interface SmsClassJoinRequest {
  id: string
  class_id: string
  student_id: string
  status: SmsClassRequestStatus
  requested_at: string
  resolved_at: string | null
}

export interface SmsClassEnrollment {
  class_id: string
  student_id: string
  status: 'active' | 'dropped'
  enrolled_at: string
}

export interface SmsAttendance {
  id: string
  class_id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes: string | null
  marked_by: string | null
  created_at: string
  updated_at: string
}

export interface SmsAssignment {
  id: string
  class_id: string
  title: string
  description: string | null
  due_date: string | null
  max_score: number
  published: boolean
  points_deduction_per_day: number
  allow_submission_types: string[]
  image_url: string | null
  resource_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SmsResource {
  id: string
  class_id: string | null
  title: string
  description: string | null
  file_url: string
  file_type: string | null
  file_size: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SmsSubmission {
  id: string
  assignment_id: string
  student_id: string
  content: string | null
  file_url: string | null
  audio_url: string | null
  storage_provider: 'supabase' | 'b2'
  submitted_at: string
  updated_at: string
}

export interface SmsGrade {
  id: string
  assignment_id: string
  student_id: string
  score: number | null
  feedback: string | null
  graded_by: string | null
  graded_at: string | null
  created_at: string
  updated_at: string
}

export type SmsAnnouncementAudience = 'school' | 'teachers' | 'parents' | 'students' | 'grade' | 'class'
export type SmsAnnouncementStatus = 'draft' | 'published' | 'archived'

export interface SmsAnnouncement {
  id: string
  title: string
  body: string
  audience_type: SmsAnnouncementAudience
  grade_level: string | null
  status: SmsAnnouncementStatus
  publish_at: string | null
  archived_at: string | null
  notify_email: boolean
  notify_push: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SmsAnnouncementClass {
  announcement_id: string
  class_id: string
}

export type SmsNotificationChannel = 'email' | 'push'
export type SmsNotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface SmsAnnouncementNotification {
  id: string
  announcement_id: string
  channel: SmsNotificationChannel
  status: SmsNotificationStatus
  requested_at: string
  sent_at: string | null
  error: string | null
}

export interface SmsSchoolSettings {
  id: number
  school_name: string
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  current_academic_year: string
  updated_at: string
}

export interface SmsAcademicYear {
  id: string
  label: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  created_at: string
}

export interface SmsGradeLevelRow {
  id: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface SmsSection {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface SmsCalendarEvent {
  id: string
  title: string
  event_date: string
  end_date: string | null
  description: string | null
  created_at: string
}

export interface SmsEmailTemplate {
  id: string
  key: string
  name: string
  subject: string
  body: string
  updated_at: string
}

export type SmsDigestFrequency = 'immediate' | 'daily' | 'weekly'

export interface SmsNotificationSettings {
  id: number
  notify_email_enabled: boolean
  notify_push_enabled: boolean
  digest_frequency: SmsDigestFrequency
  updated_at: string
}

export type SmsBackupFrequency = 'daily' | 'weekly' | 'monthly'

export interface SmsBackupSettings {
  id: number
  auto_backup_enabled: boolean
  backup_frequency: SmsBackupFrequency
  retention_days: number
  last_backup_at: string | null
  updated_at: string
}

export interface WebsiteRegistration {
  id: string
  student_first_name: string
  student_last_name: string
  student_age: number | null
  student_grade: string | null
  student_tamil_level: string | null
  parent_first_name: string
  parent_last_name: string
  parent_email: string
  parent_phone: string
  preferred_class_level: string | null
  preferred_class_time: string | null
  registration_status: 'pending' | 'approved' | 'waitlisted' | 'rejected'
  registration_date: string
  academic_year: string
  notes: string | null
  created_at: string
}
