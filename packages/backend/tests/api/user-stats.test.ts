
import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/server'
import { prisma, createTestUser } from '../setup'

describe('User Stats API', () => {
  let token: string
  let userId: number

  beforeEach(async () => {
    // Create user
    const { user, email } = await createTestUser()
    userId = user.id
    
    // Login to get token
    const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
            email,
            password: 'testpassword123'
        }
    })
    
    const body = loginRes.json()
    if (!body.success) {
        throw new Error(`Login failed: ${body.error}`)
    }
    token = body.data.token
  })

  it('should return correct stats', async () => {
    // Create notes
    await prisma.note.create({
        data: {
            user_id: userId,
            title: 'Note 1',
            content: 'Hello World', // 11 chars
            folder_id: null
        }
    })
    
    await prisma.note.create({
        data: {
            user_id: userId,
            title: 'Note 2',
            content: 'Testing', // 7 chars
            folder_id: null
        }
    })
    
    // Total: 18 chars. Active days: 1 (today).

    const response = await app.inject({
      method: 'GET',
      url: '/api/user/stats',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    expect(response.statusCode).toBe(200)
    const data = response.json().data
    expect(data.totalWordCount).toBe(18)
    expect(data.activeDays).toBe(1)
  })
  
  it('should include reviews in stats', async () => {
      // Create a review
      await prisma.review.create({
          data: {
              user_id: userId,
              date: new Date(),
              content: 'My Review', // 9 chars
          }
      })
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/stats',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
  
      expect(response.statusCode).toBe(200)
      const data = response.json().data
      // 18 from previous test (if DB not cleaned? beforeEach cleans DB)
      // beforeEach calls cleanupDatabase.
      // So here only Review exists.
      expect(data.totalWordCount).toBe(9)
      expect(data.activeDays).toBe(1)
  })
})
