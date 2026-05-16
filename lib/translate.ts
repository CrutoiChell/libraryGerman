/**
 * Best-effort English → Russian translation via the public MyMemory API.
 * Used by auto-seed, admin tools, and maintenance scripts.
 */

export const TRANSLATE_CHUNK_MAX_LENGTH = 480
export const TRANSLATE_MIN_LENGTH = 10
export const DESCRIPTION_MAX_LENGTH = 5000
export const TRANSLATE_API_DELAY_MS = 100

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True when more than half of alphabetic characters are Cyrillic. */
export function isMostlyCyrillic(text: string): boolean {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length
  const allLetters = (text.match(/[A-Za-z\u0400-\u04FF]/g) ?? []).length
  if (allLetters === 0) return false
  return cyrillic / allLetters > 0.5
}

async function translateChunk(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text,
    )}&langpair=en|ru`
    const res = await fetch(url)
    if (!res.ok) return text
    const json = (await res.json()) as {
      responseData?: { translatedText?: string }
    }
    const translated = json.responseData?.translatedText
    if (typeof translated !== 'string' || translated.length === 0) {
      return text
    }
    const upper = translated.toUpperCase()
    if (
      upper.startsWith('PLEASE SELECT') ||
      upper.startsWith('MYMEMORY WARNING')
    ) {
      return text
    }
    return translated
  } catch {
    return text
  }
}

export async function translateToRussian(text: string): Promise<string> {
  const input = text.trim()
  if (input.length === 0 || input.length < TRANSLATE_MIN_LENGTH) {
    return text
  }

  if (input.length <= TRANSLATE_CHUNK_MAX_LENGTH) {
    return await translateChunk(input)
  }

  const sentences = input.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let buffer = ''
  for (const sentence of sentences) {
    if (sentence.length === 0) continue
    if (sentence.length > TRANSLATE_CHUNK_MAX_LENGTH) {
      if (buffer.length > 0) {
        chunks.push(buffer)
        buffer = ''
      }
      chunks.push(sentence)
      continue
    }
    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`
    if (candidate.length > TRANSLATE_CHUNK_MAX_LENGTH) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer = candidate
    }
  }
  if (buffer.length > 0) chunks.push(buffer)

  const translated: string[] = []
  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleep(TRANSLATE_API_DELAY_MS)
    translated.push(await translateChunk(chunks[i]!))
  }
  return translated.join(' ')
}

export async function translateToRussianIfNeeded(text: string): Promise<string> {
  if (isMostlyCyrillic(text)) return text
  return translateToRussian(text)
}

export interface BookTextFields {
  title: string
  author: string
  description: string
}

/** Translate title, author, and description when they look English. */
export async function translateBookFields(fields: BookTextFields): Promise<void> {
  const keys: Array<keyof BookTextFields> = ['title', 'author', 'description']
  for (let i = 0; i < keys.length; i += 1) {
    if (i > 0) await sleep(TRANSLATE_API_DELAY_MS)
    const key = keys[i]!
    let next = await translateToRussianIfNeeded(fields[key])
    if (key === 'description' && next.length > DESCRIPTION_MAX_LENGTH) {
      next = next.slice(0, DESCRIPTION_MAX_LENGTH)
    }
    fields[key] = next
  }
}

/** Translate an array of short strings (admin autofill). Max 10 items. */
export async function translateTexts(texts: string[]): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < texts.length; i += 1) {
    if (i > 0) await sleep(TRANSLATE_API_DELAY_MS)
    out.push(await translateToRussianIfNeeded(texts[i] ?? ''))
  }
  return out
}
