'use client'

/**
 * Login page.
 *
 * Client-rendered so we can call `supabase.auth.signInWithPassword`
 * directly through the browser Supabase client; the resulting session
 * cookie is set by `@supabase/ssr` and is readable by server
 * components on the next request.
 *
 * Validation flow:
 *   1. Zod (`AuthCredentialsSchema`) validates email shape and the
 *      8-character minimum password length on submit. Field-level
 *      errors render under each input.
 *   2. Supabase decides whether the credentials are correct. A
 *      failed sign-in surfaces as a single form-level error
 *      ("Invalid email or password") above the form.
 *
 * After a successful login we `router.push('/')` and call
 * `router.refresh()`. The refresh re-runs server components so the
 * NavBar (which reads the session) re-renders with the user's email
 * without a full page reload.
 *
 * Validates Requirements 6.2, 6.3, 6.7.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { AuthCredentialsSchema } from '@/lib/auth/schemas'
import { createClient } from '@/lib/supabase/browser'

/**
 * Per-field error messages keyed by form field name. `_form` holds
 * a single form-level error (e.g. authentication failure) rendered
 * above the inputs.
 */
type FieldErrors = Partial<Record<'email' | 'password' | '_form', string>>

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})

    const parsed = AuthCredentialsSchema.safeParse({ email, password })
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const next: FieldErrors = {}
      if (flat.fieldErrors.email?.[0]) next.email = flat.fieldErrors.email[0]
      if (flat.fieldErrors.password?.[0]) {
        next.password = flat.fieldErrors.password[0]
      }
      setErrors(next)
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error) {
        // Surface a generic message rather than echoing Supabase's
        // wording so we don't leak whether an email exists.
        setErrors({ _form: 'Неверный email или пароль' })
        return
      }

      // Push to home and refresh so the server NavBar picks up the
      // new session cookie (Requirement 6.6).
      router.push('/')
      router.refresh()
    } catch {
      setErrors({ _form: 'Что-то пошло не так. Попробуйте ещё раз.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Вход
        </h1>
        <p className="text-sm text-white/70">
          С возвращением. Войдите, чтобы открыть свои закладки.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="glass flex flex-col gap-4 rounded-2xl p-6"
        aria-describedby={errors._form ? 'login-form-error' : undefined}
      >
        {errors._form ? (
          <p
            id="login-form-error"
            role="alert"
            data-testid="login-form-error"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {errors._form}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-email"
            className="text-sm font-medium text-white/80"
          >
            Эл. почта
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            placeholder="вы@example.com"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.email ? (
            <p
              id="login-email-error"
              data-testid="login-email-error"
              className="text-xs text-red-300"
            >
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-white/80"
          >
            Пароль
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'login-password-error' : undefined
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.password ? (
            <p
              id="login-password-error"
              data-testid="login-password-error"
              className="text-xs text-red-300"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <p className="text-center text-sm text-white/70">
        Нет аккаунта?{' '}
        <Link
          href="/signup"
          className="font-medium text-accent transition-colors duration-200 hover:opacity-90"
        >
          Регистрация
        </Link>
      </p>
    </div>
  )
}
