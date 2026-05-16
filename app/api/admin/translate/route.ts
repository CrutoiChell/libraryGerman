import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdmin } from '@/lib/api/auth'
import { translateTexts } from '@/lib/translate'

const BodySchema = z.object({
  texts: z.array(z.string().max(5000)).min(1).max(10),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const texts = await translateTexts(parsed.data.texts)
  return NextResponse.json({ texts })
}
