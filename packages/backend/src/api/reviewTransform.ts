import type { Review as PrismaReview } from '@prisma/client'
import type { Review as SharedReview } from '@webnote/shared/types'

const toDateString = (value: Date) => value.toISOString().split('T')[0]

export const parseJsonStringArray = (value: unknown): string[] | undefined => {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string') return undefined
  if (!value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    return [value]
  }

  return [value]
}

export const normalizeReview = (review: PrismaReview): SharedReview => {
  return {
    id: review.id,
    user_id: review.user_id,
    date: toDateString(review.date),
    content: review.content,
    mood: review.mood ?? undefined,
    achievements: parseJsonStringArray(review.achievements),
    improvements: parseJsonStringArray(review.improvements),
    plans: parseJsonStringArray(review.plans),
    template_id: review.template_id ?? undefined,
    spirit: review.spirit ?? undefined,
    energy: review.energy ?? undefined,
    focus: review.focus ?? undefined,
    creativity: review.creativity ?? undefined,
    emotion: review.emotion ?? undefined,
    social: review.social ?? undefined,
    focus_score: review.focus_score ?? undefined,
    energy_score: review.energy_score ?? undefined,
    mood_score: review.mood_score ?? undefined,
    prime_directive: review.prime_directive ?? undefined,
    system_interrupts: review.system_interrupts ?? undefined,
    attachments: parseJsonStringArray(review.attachments),
    created_at: review.created_at.toISOString(),
    updated_at: review.updated_at.toISOString()
  }
}

