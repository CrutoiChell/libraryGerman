import { describe, expect, it } from 'vitest'

import { AuthCredentialsSchema, MIN_PASSWORD_LENGTH } from '@/lib/auth/schemas'
import { BookInputSchema } from '@/lib/validation'

describe('BookInputSchema', () => {
  const valid = {
    title: 'Война и мир',
    author: 'Лев Толстой',
    description: 'Роман.',
    genre: 'Классика',
    cover_url: 'https://example.com/cover.jpg',
    external_link: 'https://example.com/book',
  }

  it('accepts a valid book payload', () => {
    expect(BookInputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects http URLs', () => {
    const result = BookInputSchema.safeParse({
      ...valid,
      cover_url: 'ftp://example.com/cover.jpg',
    })
    expect(result.success).toBe(false)
  })
})

describe('AuthCredentialsSchema', () => {
  it('requires a valid email', () => {
    const result = AuthCredentialsSchema.safeParse({
      email: 'not-an-email',
      password: '12345678',
    })
    expect(result.success).toBe(false)
  })

  it('enforces minimum password length', () => {
    const result = AuthCredentialsSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toContain(
        String(MIN_PASSWORD_LENGTH),
      )
    }
  })
})
