# Каталог библиотеки (Online Library Catalog)

Веб-приложение для просмотра кураторского каталога книг: поиск, фильтры по жанрам, закладки и админ-панель. Интерфейс на русском языке.

**Стек:** Next.js 14 (App Router), Supabase (Auth, Postgres, Storage), Redux Toolkit Query, Zod, Tailwind CSS.

## Возможности

- Каталог с поиском по названию и автору
- Фильтр по жанрам
- Карточка книги и ссылка «Читать онлайн»
- Регистрация, вход, личные закладки
- Админ-панель: CRUD, скрытие книг, пополнение из Open Library
- Автоперевод названия, автора и описания при импорте (MyMemory API)

## Быстрый старт

### 1. Зависимости

```bash
npm install
```

### 2. Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В SQL Editor выполните миграции по порядку из `supabase/migrations/`.
3. Скопируйте `.env.example` в `.env.local` и заполните ключи из **Project Settings → API**.

```bash
cp .env.example .env.local
```

### 3. Storage и администратор

```bash
node scripts/setup-storage.mjs
node scripts/create-admin.mjs
```

Скрипт `create-admin.mjs` создаёт пользователя с ролью `admin` (email/пароль задаются в скрипте или через переменные окружения — см. файл).

### 4. Настройка Auth в Supabase (важно для регистрации)

В [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**:

| Поле | Значение (локально) |
|------|---------------------|
| **Site URL** | `http://localhost:3000` |
| **Redirect URLs** | `http://localhost:3000/auth/callback` |

Для production добавьте `https://ваш-домен/auth/callback` и задайте `NEXT_PUBLIC_SITE_URL` в env.

**Если регистрация даёт 400/ошибку redirect:** проверьте Redirect URLs (см. выше).

**Для диплома проще:** **Authentication** → **Providers** → **Email** → отключите **Confirm email** — тогда вход сразу после регистрации, без письма.

### 5. Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (только сервер, не публиковать) |
| `ENABLE_PUBLIC_AUTO_SEED` | `true` — автозаполнение каталога на главной при пустой БД (по умолчанию выключено) |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Для Playwright E2E (опционально) |

## Пополнение каталога

**Рекомендуется (админ):** войдите как admin → **Админ** → **Пополнить из Open Library**.

**Публичный автосид** (не рекомендуется для продакшена):

```env
ENABLE_PUBLIC_AUTO_SEED=true
```

**Перевод уже загруженных английских книг:**

```bash
node scripts/translate-books.mjs --yes
```

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Режим разработки |
| `npm run build` | Production-сборка |
| `npm run start` | Запуск собранного приложения |
| `npm run lint` | ESLint |
| `npm test` | Unit-тесты (Vitest) |
| `npm run test:e2e` | E2E (Playwright, нужен живой Supabase) |

## Деплой (Vercel + Supabase)

1. Подключите репозиторий к Vercel.
2. Добавьте те же переменные, что в `.env.local` (service role — только в Environment Variables Vercel, не в клиенте).
3. `ENABLE_PUBLIC_AUTO_SEED` оставьте пустым или `false`.
4. После деплоя выполните миграции и `create-admin` против production Supabase.

## Безопасность

- Не коммитьте `.env.local` и `info.txt`.
- Service role обходит RLS — используйте только на сервере.
- Эндпоинты `/api/admin/*` защищены проверкой роли admin.
- RLS: книги читают все (скрытые — только admin), закладки — только владелец.

## Структура проекта

```
app/           — страницы и API routes
components/    — UI-компоненты
lib/           — Supabase, БД, store, валидация, перевод
supabase/      — SQL-миграции
scripts/       — админ и обслуживание
tests/e2e/     — Playwright
```

## Лицензия

Учебный / дипломный проект. Используйте на своё усмотрение.
