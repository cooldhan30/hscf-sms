const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_RE.test(email)
}

export function requireString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field} is required`)
    return ''
  }
  return value.trim()
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  return value.trim()
}

export function requireEmail(value: unknown, field: string, errors: string[]): string {
  const email = requireString(value, field, errors)
  if (email && !isValidEmail(email)) {
    errors.push(`${field} must be a valid email address`)
  }
  return email
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  errors: string[]
): T | undefined {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}`)
    return undefined
  }
  return value as T
}
