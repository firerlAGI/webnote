
import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../../src/server'
import { prisma, createTestUser, cleanupDatabase } from '../setup'

describe('User Stats API', () => {
  let token: string
  let userId: number

  beforeEach(async () => {
    await cleanupDatabase()
    const { user, email } = await createTestUser()
    userId = user.id
    
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
    await prisma.note.create({
        data: {
            user_id: userId,
            title: 'Note 1',
            content: 'Hello World',
            folder_id: null
        }
    })
    
    await prisma.note.create({
        data: {
            user_id: userId,
            title: 'Note 2',
            content: 'Testing',
            folder_id: null
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
    expect(data.totalWordCount).toBe(18)
    expect(data.activeDays).toBe(1)
  })
  
  it('should include reviews in stats', async () => {
      await prisma.review.create({
          data: {
              user_id: userId,
              date: new Date(),
              content: 'My Review',
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
      expect(data.totalWordCount).toBe(9)
      expect(data.activeDays).toBe(1)
  })
})
