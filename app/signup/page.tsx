'use client'

/**
 * Signup page.
 *
 * Mirrors the login page's structure so the two screens stay
 * visually and behaviorally consistent. The only meaningful
 * difference is the call into Supabase (`signUp` instead of
 * `signInWithPassword`) and the duplicate-email handling.
 *
 * Validation flow:
 *   1. Zod (`AuthCredentialsSchema`) validates email shape and the
 *      8-character minimum password length on submit
 *      (Requirement 6.7). Field-level errors render under each
 *      input.
 *   2. Supabase creates the account. The `handle_new_user` trigger
 *      then inserts a `profiles` row with role `'user'`
 *      (Requirement 6.1).
 *
 * Supabase's `signUp` does not raise an error on duplicate email by
 * default; instead it returns a "user" object whose `identities`
 * array is empty. We treat that as a duplicate and surface a
 * form-level error (Requirement 6.4). An explicit `error` from
 * Supabase is also surfaced as a form-level error.
 *
 * Three-way response handling:
 *   - `data.session` exists → email confirmation is OFF in
 *     Supabase, the session is live, push to `/` + refresh.
 *   - `data.session` is null and `data.user.identities.length > 0`
 *     → email confirmation is ON, render the "проверьте почту"
 *     screen instead of redirecting.
 *   - `data.session` is null and `data.user.identities.length === 0`
 *     → duplicate email, surface form-level error.
 *
 * NOTE: disabling "Confirm email" in the Supabase Auth dashboard
 * removes the need for the check-your-email screen — the first
 * branch above will fire and the user is signed in immediately.
 *
 * Validates Requirements 6.4, 6.7 (and supports 6.1 indirectly via
 * the `handle_new_user` trigger).
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { AuthCredentialsSchema } from '@/lib/auth/schemas'
import { createClient } from '@/lib/supabase/browser'

/**
 * Per-field error messages keyed by form field name. `_form` holds
 * a single form-level error rendered above the inputs.
 */
type FieldErrors = Partial<Record<'email' | 'password' | '_form', string>>

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set to `true` when Supabase accepts the signup but did not
  // return a live session because email confirmation is enabled.
  // The form is replaced with a friendly "check your email" card.
  const [emailSent, setEmailSent] = useState(false)
  // Captured separately from `email` so the success card keeps
  // showing the address even after the input is cleared.
  const [sentToEmail, setSentToEmail] = useState('')

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
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error) {
        // Supabase exposes a `User already registered` error when
        // confirmations are required. Map it to the form-level
        // duplicate-email message; surface other errors as a
        // generic message so we don't leak provider details.
        const isDuplicate =
          /already\s+registered/i.test(error.message) ||
          /already.*exists/i.test(error.message)
        setErrors({
          _form: isDuplicate
            ? 'Аккаунт с таким email уже существует.'
            : 'Не удалось создать аккаунт. Попробуйте ещё раз.',
        })
        return
      }

      // When email confirmations are enabled and the address is
      // already registered, Supabase returns a fake user with an
      // empty `identities` array instead of an error. Treat that
      // as a duplicate (Requirement 6.4).
      const identities = data.user?.identities ?? []
      if (data.user && identities.length === 0) {
        setErrors({
          _form: 'Аккаунт с таким email уже существует.',
        })
        return
      }

      if (data.session) {
        // Email confirmation is OFF: the session is live. Refresh
        // so the server NavBar picks up the new session cookie
        // (Requirement 6.6) and any profile row created by the
        // `handle_new_user` trigger.
        router.push('/')
        router.refresh()
        return
      }

      if (data.user && identities.length > 0) {
        // Email confirmation is ON: Supabase has sent a
        // confirmation link to the supplied address. Show a
        // success card instead of redirecting — the user can't
        // log in until they click the link.
        setSentToEmail(parsed.data.email)
        setEmailSent(true)
        return
      }

      // Defensive: neither a live session nor an email-confirmation
      // user. Surface a generic message so the screen still reacts.
      setErrors({ _form: 'Не удалось создать аккаунт. Попробуйте ещё раз.' })
    } catch {
      setErrors({ _form: 'Что-то пошло не так. Попробуйте ещё раз.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
        <div
          data-testid="signup-email-sent"
          className="glass flex flex-col gap-4 rounded-2xl p-6 text-center"
        >
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Проверьте почту
          </h1>
          <p className="text-sm text-white/80">
            Мы отправили ссылку для подтверждения на адрес{' '}
            <span className="font-medium text-white">{sentToEmail}</span>.
          </p>
          <p className="text-sm text-white/70">
            Перейдите по ссылке из письма, чтобы активировать аккаунт.
            После подтверждения вы сможете войти.
          </p>
          <Link
            href="/login"
            className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90"
          >
            Войти
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Создать аккаунт
        </h1>
        <p className="text-sm text-white/70">
          Зарегистрируйтесь, чтобы сохранять закладки и собирать свой
          список книг.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="glass flex flex-col gap-4 rounded-2xl p-6"
        aria-describedby={errors._form ? 'signup-form-error' : undefined}
      >
        {errors._form ? (
          <p
            id="signup-form-error"
            role="alert"
            data-testid="signup-form-error"
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {errors._form}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="signup-email"
            className="text-sm font-medium text-white/80"
          >
            Эл. почта
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            placeholder="вы@example.com"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.email ? (
            <p
              id="signup-email-error"
              data-testid="signup-email-error"
              className="text-xs text-red-300"
            >
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="signup-password"
            className="text-sm font-medium text-white/80"
          >
            Пароль
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'signup-password-error' : undefined
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.password ? (
            <p
              id="signup-password-error"
              data-testid="signup-password-error"
              className="text-xs text-red-300"
            >
              {errors.password}
            </p>
          ) : (
            <p className="text-xs text-white/50">
              Не короче 8 символов.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="text-center text-sm text-white/70">
        Уже есть аккаунт?{' '}
        <Link
          href="/login"
          className="font-medium text-accent transition-colors duration-200 hover:opacity-90"
        >
          Войти
        </Link>
      </p>
    </div>
  )
}
