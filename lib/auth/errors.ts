/**
 * Map Supabase Auth API errors to user-facing Russian messages.
 */
export function mapAuthError(error: {
  message?: string
  code?: string
  status?: number
}): string {
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  if (
    code === 'over_email_send_rate_limit' ||
    msg.includes('rate limit') ||
    error.status === 429
  ) {
    return 'Слишком много писем с подтверждением. Подождите 10–15 минут или в Supabase отключите «Confirm email» (Authentication → Providers → Email).'
  }

  if (
    code === 'signup_disabled' ||
    (msg.includes('signup') && msg.includes('disabled'))
  ) {
    return 'Регистрация отключена в настройках Supabase (Authentication → Providers).'
  }

  if (
    code === 'weak_password' ||
    msg.includes('password should be') ||
    msg.includes('weak password')
  ) {
    return 'Пароль слишком простой. Минимум 8 символов, буквы и цифры.'
  }

  if (
    code === 'email_address_invalid' ||
    msg.includes('invalid email') ||
    msg.includes('unable to validate email')
  ) {
    return 'Некорректный адрес email.'
  }

  if (
    msg.includes('redirect') ||
    msg.includes('redirect_to') ||
    code === 'validation_failed'
  ) {
    return 'Неверный URL перенаправления. В Supabase добавьте Redirect URL: ваш-сайт/auth/callback (для локальной разработки: http://localhost:3000/auth/callback).'
  }

  if (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('already been registered') ||
    code === 'user_already_exists'
  ) {
    return 'Аккаунт с таким email уже существует.'
  }

  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Сначала подтвердите email по ссылке из письма, затем войдите.'
  }

  if (msg.includes('captcha') || code === 'captcha_failed') {
    return 'Требуется проверка captcha. Отключите captcha в Supabase Auth или настройте её в приложении.'
  }

  if (error.message && error.message.length < 200) {
    return error.message
  }

  return 'Не удалось выполнить запрос. Проверьте email и пароль или настройки Supabase.'
}
