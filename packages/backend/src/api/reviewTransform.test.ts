import { describe, expect, it } from 'vitest'
import type { Review as PrismaReview } from '@prisma/client'
import { normalizeReview, parseJsonStringArray } from './reviewTransform.js'

describe('reviewTransform', () => {
  it('parseJsonStringArray parses JSON string arrays', () => {
    expect(parseJsonStringArray('["main","sub"]')).toEqual(['main', 'sub'])
    expect(parseJsonStringArray(null)).toBeUndefined()
    expect(parseJsonStringArray('')).toEqual([])
    expect(parseJsonStringArray('main')).toEqual(['main'])
  })

  it('normalizeReview converts json fields and date', () => {
    const prismaReview: PrismaReview = {
      id: 1,
      user_id: 2,
      date: new Date('2026-01-18T00:00:00.000Z'),
      content: 'body',
      mood: 8,
      achievements: '["main"]',
      improvements: '[]',
      plans: null,
      template_id: null,
      spirit: null,
      energy: null,
      focus: null,
      creativity: null,
      emotion: null,
      social: null,
      focus_score: null,
      energy_score: null,
      mood_score: null,
      prime_directive: null,
      system_interrupts: null,
      attachments: '["a.png"]',
      created_at: new Date('2026-01-18T01:02:03.000Z'),
      updated_at: new Date('2026-01-18T04:05:06.000Z')
    }

    const normalized = normalizeReview(prismaReview)
    expect(normalized.date).toBe('2026-01-18')
    expect(normalized.achievements).toEqual(['main'])
    expect(normalized.improvements).toEqual([])
    expect(normalized.plans).toBeUndefined()
    expect(normalized.attachments).toEqual(['a.png'])
    expect(normalized.created_at).toBe('2026-01-18T01:02:03.000Z')
  })
})

