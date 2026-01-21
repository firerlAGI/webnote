import { FastifyInstance, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { prisma } from '../server.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { backupService, RestoreOptions } from '../services/backup/BackupService.js'
import { normalizeReview } from './reviewTransform.js'

// User type for JWT payload
interface UserPayload {
  id: number
  username: string
}

// Authentication middleware
const authenticate = async (request: FastifyRequest) => {
  try {
    await request.jwtVerify()
  } catch (error) {
    throw new Error('Unauthorized')
  }
}

// Authorization middleware for resource ownership
const authorizeResource = async (request: FastifyRequest, resourceType: 'note' | 'folder' | 'review', resourceId: number) => {
  const userId = (request.user as UserPayload).id
  
  let resource: { user_id: number } | null = null
  switch (resourceType) {
    case 'note':
      resource = await prisma.note.findUnique({ where: { id: resourceId }, select: { user_id: true } })
      break
    case 'folder':
      resource = await prisma.folder.findUnique({ where: { id: resourceId }, select: { user_id: true } })
      break
    case 'review':
      resource = await prisma.review.findUnique({ where: { id: resourceId }, select: { user_id: true } })
      break
    default:
      throw new Error('Invalid resource type')
  }
  
  if (!resource) {
    throw new Error('Resource not found')
  }
  
  if (resource.user_id !== userId) {
    throw new Error('Forbidden')
  }
}

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Allowed image file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Helper function to validate image file
const validateImageFile = (mimetype: string, fileSize: number): { valid: boolean; error?: string } => {
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.' }
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit.' }
  }
  
  return { valid: true }
}

// Helper function to generate unique filename
const generateFilename = (originalName: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = path.extname(originalName)
  return `${timestamp}-${random}${ext}`
}

// Helper function to ensure uploads directory exists
const ensureUploadsDirectory = (): void => {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

export async function routes(app: FastifyInstance) {
  // Public routes
  app.get('/', async () => {
    return { hello: 'world' }
  })

  // Auth routes
  app.post('/auth/register', async (request, reply) => {
    const { username, email, password } = request.body as { username: string; email: string; password: string }
    
    if (!username || !email || !password) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
      })
      
      if (existingUser) {
        return reply.status(400).send({ success: false, error: 'Username or email already exists' })
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)
      
      // Create user
      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword
        },
        select: {
          id: true,
          username: true,
          email: true,
          created_at: true,
          updated_at: true
        }
      })
      
      // Generate JWT token
      const token = app.jwt.sign({ id: user.id, username: user.username })
      
      return reply.status(201).send({
        success: true,
        data: { user, token },
        message: 'User registered successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    
    if (!email || !password) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Find user by email
      const user = await prisma.user.findUnique({ where: { email } })
      
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' })
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password)
      
      if (!isPasswordValid) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' })
      }
      
      // Generate JWT token
      const token = app.jwt.sign({ id: user.id, username: user.username })
      
      // Return user data without password
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
      
      return reply.status(200).send({
        success: true,
        data: { user: userData, token },
        message: 'Login successful'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/auth/forgot-password', async (request, reply) => {
    const { email } = request.body as { email: string }
    
    if (!email) {
      return reply.status(400).send({ success: false, error: 'Missing email' })
    }
    
    try {
      // Find user by email
      const user = await prisma.user.findUnique({ where: { email } })
      
      if (!user) {
        // Return success even if user doesn't exist to prevent email enumeration
        return reply.status(200).send({
          success: true,
          message: 'If an account with this email exists, a reset link will be sent'
        })
      }
      
      // Generate reset token (in a real app, you would send this to the user's email)
      const resetToken = app.jwt.sign({ id: user.id }, { expiresIn: '1h' })
      
      // For demo purposes, we'll just return the token
      return reply.status(200).send({
        success: true,
        data: { resetToken },
        message: 'Reset token generated'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/auth/reset-password', async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string }
    
    if (!token || !password) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Verify token
      const decoded = app.jwt.verify(token) as { id: number }
      
      // Find user
      const user = await prisma.user.findUnique({ where: { id: decoded.id } })
      
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' })
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10)
      
      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Password reset successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Protected routes
  app.get('/protected', { preHandler: authenticate }, async (request) => {
    return { message: 'This is a protected route', user: request.user }
  })

  // Image upload route
  app.post('/upload/image', { preHandler: authenticate }, async (request, reply) => {
    try {
      const data = await (request as any).file()
      
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded'
        })
      }
      
      // Validate file type and size
      const validation = validateImageFile(data.mimetype, data.file.bytesRead)
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: validation.error
        })
      }
      
      // Ensure uploads directory exists
      ensureUploadsDirectory()
      
      // Generate unique filename
      const filename = generateFilename(data.filename)
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
      const filepath = path.join(uploadsDir, filename)
      
      // Write file to disk
      const buffer = await data.toBuffer()
      fs.writeFileSync(filepath, buffer)
      
      // Generate URL for the uploaded image
      const imageUrl = `${request.protocol}://${request.hostname}${process.env.PORT ? ':' + process.env.PORT : ''}/uploads/${filename}`
      
      return reply.status(200).send({
        success: true,
        data: {
          filename,
          url: imageUrl,
          mimetype: data.mimetype,
          size: data.file.bytesRead
        },
        message: 'Image uploaded successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // User routes
  app.get('/user/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = (request.user as UserPayload).id
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          created_at: true,
          updated_at: true
        }
      })
      
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' })
      }
      
      return reply.status(200).send({
        success: true,
        data: user,
        message: 'User information retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/user/stats', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = (request.user as UserPayload).id
      
      // Calculate total word count from notes and reviews
      // We fetch only necessary fields to minimize data transfer from DB
      const [notes, reviews] = await Promise.all([
        prisma.note.findMany({
          where: { user_id: userId },
          select: { content: true, created_at: true, updated_at: true }
        }),
        prisma.review.findMany({
          where: { user_id: userId },
          select: { content: true, created_at: true, updated_at: true }
        })
      ])
      
      let totalWordCount = 0
      
      // Helper to count characters (simple length for now)
      const countCharacters = (text: string) => {
         return text ? text.length : 0
      }
      
      const activeDates = new Set<string>()
      
      notes.forEach(note => {
        if (note.content) totalWordCount += countCharacters(note.content)
        activeDates.add(note.created_at.toISOString().split('T')[0])
        activeDates.add(note.updated_at.toISOString().split('T')[0])
      })
      
      reviews.forEach(review => {
        if (review.content) totalWordCount += countCharacters(review.content)
        activeDates.add(review.created_at.toISOString().split('T')[0])
        activeDates.add(review.updated_at.toISOString().split('T')[0])
      })
      
      const activeDays = activeDates.size
      
      return reply.status(200).send({
        success: true,
        data: {
          totalWordCount,
          activeDays
        },
        message: 'User statistics retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.put('/user/me', { preHandler: authenticate }, async (request, reply) => {
    const { username, email } = request.body as { username?: string; email?: string }
    const userId = (request.user as UserPayload).id
    
    try {
      // Check if username or email is already taken by another user
      if (username || email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: username || '' },
              { email: email || '' }
            ],
            NOT: { id: userId }
          }
        })
        
        if (existingUser) {
          return reply.status(400).send({ success: false, error: 'Username or email already exists' })
        }
      }
      
      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(username && { username }),
          ...(email && { email })
        },
        select: {
          id: true,
          username: true,
          email: true,
          created_at: true,
          updated_at: true
        }
      })
      
      return reply.status(200).send({
        success: true,
        data: updatedUser,
        message: 'User information updated successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Note routes
  app.post('/notes', { preHandler: authenticate }, async (request, reply) => {
    const { title, content, folder_id, is_pinned } = request.body as { 
      title: string; 
      content: string; 
      folder_id?: number; 
      is_pinned?: boolean 
    }
    
    if (!title || !content) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Validate folder ownership if provided
      if (folder_id) {
        const folder = await prisma.folder.findUnique({ where: { id: folder_id } })
        if (!folder || folder.user_id !== (request.user as UserPayload).id) {
          return reply.status(400).send({ success: false, error: 'Invalid folder' })
        }
      }
      
      // Create note
      const note = await prisma.note.create({
        data: {
          user_id: (request.user as UserPayload).id,
          title,
          content,
          folder_id,
          is_pinned: is_pinned || false
        },
        include: {
          folder: true
        }
      })
      
      return reply.status(201).send({
        success: true,
        data: note,
        message: 'Note created successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/notes', { preHandler: authenticate }, async (request, reply) => {
    const { 
      search, 
      folder_id, 
      is_pinned, 
      sort_by = 'updated_at', 
      sort_order = 'desc',
      page = 1,
      limit = 20
    } = request.query as {
      search?: string;
      folder_id?: string;
      is_pinned?: string;
      sort_by?: string;
      sort_order?: string;
      page?: string;
      limit?: string;
    }
    
    try {
      const where: any = {
        user_id: (request.user as UserPayload).id,
        ...(folder_id && { folder_id: parseInt(folder_id) }),
        ...(is_pinned !== undefined && { is_pinned: is_pinned === 'true' }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { content: { contains: search, mode: 'insensitive' as const } }
          ]
        })
      }
      
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString())
      
      const [notes, total] = await Promise.all([
        prisma.note.findMany({
          where,
          select: {
            id: true,
            user_id: true,
            title: true,
            content: true,
            folder_id: true,
            is_pinned: true,
            last_accessed_at: true,
            content_hash: true,
            created_at: true,
            updated_at: true,
            folder: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            [sort_by]: sort_order
          },
          skip,
          take: parseInt(limit.toString())
        }),
        prisma.note.count({ where })
      ])
      
      return reply.status(200).send({
        success: true,
        data: {
          notes,
          pagination: {
            page: parseInt(page.toString()),
            limit: parseInt(limit.toString()),
            total,
            totalPages: Math.ceil(total / parseInt(limit.toString()))
          }
        },
        message: 'Notes retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/notes/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'note', parseInt(id))
      
      // Get note
      const note = await prisma.note.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          user_id: true,
          title: true,
          content: true,
          folder_id: true,
          is_pinned: true,
          last_accessed_at: true,
          content_hash: true,
          created_at: true,
          updated_at: true,
          folder: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
      
      if (!note) {
        return reply.status(404).send({ success: false, error: 'Note not found' })
      }
      
      // Update last_accessed_at
      await prisma.note.update({
        where: { id: parseInt(id) },
        data: { last_accessed_at: new Date() }
      })
      
      return reply.status(200).send({
        success: true,
        data: note,
        message: 'Note retrieved successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Note not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.put('/notes/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { title, content, folder_id, is_pinned } = request.body as { 
      title?: string; 
      content?: string; 
      folder_id?: number; 
      is_pinned?: boolean 
    }
    
    try {
      // Check ownership
      await authorizeResource(request, 'note', parseInt(id))
      
      // Validate folder ownership if provided
      if (folder_id !== undefined) {
        if (folder_id === null) {
          // Allow removing from folder
        } else {
          const folder = await prisma.folder.findUnique({ where: { id: folder_id } })
          if (!folder || folder.user_id !== (request.user as UserPayload).id) {
            return reply.status(400).send({ success: false, error: 'Invalid folder' })
          }
        }
      }
      
      // Update note
      const note = await prisma.note.update({
        where: { id: parseInt(id) },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(folder_id !== undefined && { folder_id }),
          ...(is_pinned !== undefined && { is_pinned })
        },
        select: {
          id: true,
          user_id: true,
          title: true,
          content: true,
          folder_id: true,
          is_pinned: true,
          last_accessed_at: true,
          content_hash: true,
          created_at: true,
          updated_at: true,
          folder: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
      
      return reply.status(200).send({
        success: true,
        data: note,
        message: 'Note updated successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Note not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.delete('/notes/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'note', parseInt(id))
      
      // Delete note
      await prisma.note.delete({
        where: { id: parseInt(id) }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Note deleted successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Note not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/notes/batch-delete', { preHandler: authenticate }, async (request, reply) => {
    const { ids } = request.body as { ids: number[] }
    
    if (!ids || !Array.isArray(ids)) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Check ownership for all notes
      for (const id of ids) {
        await authorizeResource(request, 'note', id)
      }
      
      // Delete notes
      await prisma.note.deleteMany({
        where: {
          id: { in: ids },
          user_id: (request.user as UserPayload).id
        }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Notes deleted successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'One or more notes not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.post('/notes/batch-pin', { preHandler: authenticate }, async (request, reply) => {
    const { ids, is_pinned } = request.body as { ids: number[]; is_pinned: boolean }
    
    if (!ids || !Array.isArray(ids) || is_pinned === undefined) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Check ownership for all notes
      for (const id of ids) {
        await authorizeResource(request, 'note', id)
      }
      
      // Update notes
      await prisma.note.updateMany({
        where: {
          id: { in: ids },
          user_id: (request.user as UserPayload).id
        },
        data: { is_pinned }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Notes updated successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'One or more notes not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Folder routes
  app.post('/folders', { preHandler: authenticate }, async (request, reply) => {
    const { name } = request.body as { name: string }
    
    if (!name) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Create folder
      const folder = await prisma.folder.create({
        data: {
          user_id: (request.user as UserPayload).id,
          name
        }
      })
      
      return reply.status(201).send({
        success: true,
        data: folder,
        message: 'Folder created successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/folders', { preHandler: authenticate }, async (request, reply) => {
    try {
      // Get all folders for user with note count
      const folders = await prisma.folder.findMany({
        where: { user_id: (request.user as UserPayload).id },
        select: {
          id: true,
          user_id: true,
          name: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: { notes: true }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      })
      
      // Format note count
      const foldersWithNoteCount = folders.map((folder: any) => ({
        ...folder,
        note_count: folder._count.notes,
        _count: undefined
      }))
      
      return reply.status(200).send({
        success: true,
        data: foldersWithNoteCount,
        message: 'Folders retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/folders/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'folder', parseInt(id))
      
      // Get folder
      const folder = await prisma.folder.findUnique({
        where: { id: parseInt(id) },
        include: {
          notes: true
        }
      })
      
      if (!folder) {
        return reply.status(404).send({ success: false, error: 'Folder not found' })
      }
      
      return reply.status(200).send({
        success: true,
        data: folder,
        message: 'Folder retrieved successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Folder not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.put('/folders/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name } = request.body as { name: string }
    
    if (!name) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Check ownership
      await authorizeResource(request, 'folder', parseInt(id))
      
      // Update folder
      const folder = await prisma.folder.update({
        where: { id: parseInt(id) },
        data: { name }
      })
      
      return reply.status(200).send({
        success: true,
        data: folder,
        message: 'Folder updated successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Folder not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.delete('/folders/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'folder', parseInt(id))
      
      // Check if folder has notes
      const folder = await prisma.folder.findUnique({
        where: { id: parseInt(id) },
        include: { notes: true }
      })
      
      if (folder && folder.notes.length > 0) {
        // Update notes to remove folder reference
        await prisma.note.updateMany({
          where: { folder_id: parseInt(id) },
          data: { folder_id: null }
        })
      }
      
      // Delete folder
      await prisma.folder.delete({
        where: { id: parseInt(id) }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Folder deleted successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Folder not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // User Settings routes
  app.get('/user/settings', { preHandler: authenticate }, async (request, reply) => {
    try {
      const userId = (request.user as UserPayload).id
      
      // Get or create user settings
      let settings = await prisma.userSettings.findUnique({
        where: { user_id: userId }
      })
      
      if (!settings) {
        // Create default settings
        settings = await prisma.userSettings.create({
          data: {
            user_id: userId,
            theme: 'cyan',
            language: 'zh-CN',
            density: 'standard',
            sync_enabled: true,
            offline_retention_days: 7,
            notifications: JSON.stringify({
              system_updates: true,
              daily_reminder: true,
              intrusion_detection: true,
              community_updates: false
            }),
            two_factor_enabled: false,
            encryption_enabled: true
          }
        })
      }
      
      // Parse notifications JSON
      const responseData = {
        ...settings,
        notifications: JSON.parse(settings.notifications)
      }
      
      return reply.status(200).send({
        success: true,
        data: responseData,
        message: 'User settings retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.put('/user/settings', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as UserPayload).id
    const {
      theme,
      language,
      density,
      sync_enabled,
      offline_retention_days,
      notifications,
      two_factor_enabled,
      encryption_enabled
    } = request.body as {
      theme?: 'cyan' | 'pink' | 'yellow'
      language?: 'zh-CN' | 'en-US' | 'ja-JP'
      density?: 'standard' | 'compact'
      sync_enabled?: boolean
      offline_retention_days?: number
      notifications?: {
        system_updates: boolean
        daily_reminder: boolean
        intrusion_detection: boolean
        community_updates: boolean
      }
      two_factor_enabled?: boolean
      encryption_enabled?: boolean
    }
    
    try {
      // Check if settings exist, create if not
      const existingSettings = await prisma.userSettings.findUnique({
        where: { user_id: userId }
      })
      
      let settings
      if (existingSettings) {
        // Update settings
        settings = await prisma.userSettings.update({
          where: { user_id: userId },
          data: {
            ...(theme && { theme }),
            ...(language && { language }),
            ...(density && { density }),
            ...(sync_enabled !== undefined && { sync_enabled }),
            ...(offline_retention_days !== undefined && { offline_retention_days }),
            ...(notifications && { notifications: JSON.stringify(notifications) }),
            ...(two_factor_enabled !== undefined && { two_factor_enabled }),
            ...(encryption_enabled !== undefined && { encryption_enabled })
          }
        })
      } else {
        // Create settings
        settings = await prisma.userSettings.create({
          data: {
            user_id: userId,
            theme: theme || 'cyan',
            language: language || 'zh-CN',
            density: density || 'standard',
            sync_enabled: sync_enabled !== undefined ? sync_enabled : true,
            offline_retention_days: offline_retention_days || 7,
            notifications: notifications ? JSON.stringify(notifications) : JSON.stringify({
              system_updates: true,
              daily_reminder: true,
              intrusion_detection: true,
              community_updates: false
            }),
            two_factor_enabled: two_factor_enabled || false,
            encryption_enabled: encryption_enabled !== undefined ? encryption_enabled : true
          }
        })
      }
      
      // Parse notifications JSON
      const responseData = {
        ...settings,
        notifications: JSON.parse(settings.notifications)
      }
      
      return reply.status(200).send({
        success: true,
        data: responseData,
        message: 'User settings updated successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.delete('/user/settings', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as UserPayload).id
    
    try {
      // Delete user settings
      await prisma.userSettings.delete({
        where: { user_id: userId }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'User settings reset to defaults successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Clear local cache route (simulated)
  app.post('/user/clear-cache', { preHandler: authenticate }, async (request, reply) => {
    try {
      // This is a simulated endpoint
      // In a real application, this would clear client-side cache
      // For now, we just return success
      return reply.status(200).send({
        success: true,
        message: 'Local cache cleared successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Review routes
  app.post('/reviews', { preHandler: authenticate }, async (request, reply) => {
    const { date, content, mood, achievements, improvements, plans, template_id } = request.body as { 
      date: string; 
      content: string; 
      mood?: number; 
      achievements?: string[]; 
      improvements?: string[]; 
      plans?: string[]; 
      template_id?: number 
    }
    
    if (!date || !content) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Create review
      const review = await prisma.review.create({
        data: {
          user_id: (request.user as UserPayload).id,
          date: new Date(date),
          content,
          mood,
          achievements: achievements ? JSON.stringify(achievements) : null,
          improvements: improvements ? JSON.stringify(improvements) : null,
          plans: plans ? JSON.stringify(plans) : null,
          template_id
        }
      })
      
      return reply.status(201).send({
        success: true,
        data: normalizeReview(review),
        message: 'Review created successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/reviews', { preHandler: authenticate }, async (request, reply) => {
    const { 
      start_date, 
      end_date, 
      mood,
      page = 1,
      limit = 20
    } = request.query as {
      start_date?: string;
      end_date?: string;
      mood?: string;
      page?: string;
      limit?: string;
    }
    
    try {
      const where: any = {
        user_id: (request.user as UserPayload).id
      }

      if (start_date || end_date) {
        const dateFilter: any = {}
        if (start_date) dateFilter.gte = new Date(start_date)
        if (end_date) {
          const endExclusive = new Date(end_date)
          endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
          dateFilter.lt = endExclusive
        }
        where.date = dateFilter
      }

      if (mood) {
        const moodValues = mood
          .split(',')
          .map(v => parseInt(v.trim()))
          .filter(v => Number.isFinite(v))

        if (moodValues.length === 1) {
          where.mood = moodValues[0]
        } else if (moodValues.length > 1) {
          where.mood = { in: moodValues }
        }
      }
      
      const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString())
      
      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          select: {
            id: true,
            user_id: true,
            date: true,
            content: true,
            mood: true,
            achievements: true,
            improvements: true,
            plans: true,
            template_id: true,
            spirit: true,
            energy: true,
            focus: true,
            creativity: true,
            emotion: true,
            social: true,
            focus_score: true,
            energy_score: true,
            mood_score: true,
            prime_directive: true,
            system_interrupts: true,
            attachments: true,
            created_at: true,
            updated_at: true
          },
          orderBy: {
            date: 'desc'
          },
          skip,
          take: parseInt(limit.toString())
        }),
        prisma.review.count({ where })
      ])
      
      return reply.status(200).send({
        success: true,
        data: {
          reviews: reviews.map(normalizeReview),
          pagination: {
            page: parseInt(page.toString()),
            limit: parseInt(limit.toString()),
            total,
            totalPages: Math.ceil(total / parseInt(limit.toString()))
          }
        },
        message: 'Reviews retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/reviews/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'review', parseInt(id))
      
      // Get review
      const review = await prisma.review.findUnique({
        where: { id: parseInt(id) }
      })
      
      if (!review) {
        return reply.status(404).send({ success: false, error: 'Review not found' })
      }
      
      return reply.status(200).send({
        success: true,
        data: normalizeReview(review),
        message: 'Review retrieved successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Review not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.put('/reviews/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { date, content, mood, achievements, improvements, plans, template_id } = request.body as { 
      date?: string; 
      content?: string; 
      mood?: number; 
      achievements?: string[]; 
      improvements?: string[]; 
      plans?: string[]; 
      template_id?: number 
    }
    
    try {
      // Check ownership
      await authorizeResource(request, 'review', parseInt(id))
      
      // Update review
      const review = await prisma.review.update({
        where: { id: parseInt(id) },
        data: {
          ...(date && { date: new Date(date) }),
          ...(content !== undefined && { content }),
          ...(mood !== undefined && { mood }),
          ...(achievements !== undefined && { achievements: JSON.stringify(achievements) }),
          ...(improvements !== undefined && { improvements: JSON.stringify(improvements) }),
          ...(plans !== undefined && { plans: JSON.stringify(plans) }),
          ...(template_id !== undefined && { template_id })
        }
      })
      
      return reply.status(200).send({
        success: true,
        data: normalizeReview(review),
        message: 'Review updated successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Review not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.delete('/reviews/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    
    try {
      // Check ownership
      await authorizeResource(request, 'review', parseInt(id))
      
      // Delete review
      await prisma.review.delete({
        where: { id: parseInt(id) }
      })
      
      return reply.status(200).send({
        success: true,
        message: 'Review deleted successfully'
      })
    } catch (error) {
      if ((error as Error).message === 'Resource not found') {
        return reply.status(404).send({ success: false, error: 'Review not found' })
      }
      if ((error as Error).message === 'Forbidden') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  app.get('/reviews/stats', { preHandler: authenticate }, async (request, reply) => {
    const { start_date, end_date } = request.query as {
      start_date?: string;
      end_date?: string;
    }
    
    try {
      const where = {
        user_id: (request.user as UserPayload).id,
        ...(start_date && { date: { gte: new Date(start_date) } }),
        ...(end_date && { date: { lte: new Date(end_date) } })
      }
      
      // Get reviews with mood
      const reviews = await prisma.review.findMany({
        where,
        select: {
          date: true,
          mood: true
        },
        orderBy: {
          date: 'asc'
        }
      })
      
      // Calculate stats
      const total = reviews.length
      const averageMood = total > 0 
        ? reviews.reduce((sum: number, review: { mood: number | null }) => sum + (review.mood || 0), 0) / total 
        : 0
      
      const periodStats = reviews.map((review: { date: Date; mood: number | null }) => ({
        date: review.date.toISOString().split('T')[0],
        mood: review.mood || 0
      }))
      
      return reply.status(200).send({
        success: true,
        data: {
          total,
          averageMood,
          periodStats
        },
        message: 'Review stats retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Get review dashboard data
  app.get('/reviews/dashboard', { preHandler: authenticate }, async (request, reply) => {
    const { date } = request.query as { date?: string }
    
    try {
      const userId = (request.user as UserPayload).id
      const targetDate = date ? new Date(date) : new Date()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      targetDate.setHours(0, 0, 0, 0)
      
      // Get review for the target date
      const currentReview = await prisma.review.findFirst({
        where: {
          user_id: userId,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      })
      
      // Calculate streak
      const allReviews = await prisma.review.findMany({
        where: {
          user_id: userId
        },
        orderBy: {
          date: 'desc'
        },
        select: {
          date: true
        }
      })
      
      let streak = 0
      const checkDate = new Date(today)
      
      // Check if there's a review for today
      const todayReview = allReviews.find(r => {
        const rDate = new Date(r.date)
        rDate.setHours(0, 0, 0, 0)
        return rDate.getTime() === today.getTime()
      })
      
      if (todayReview) {
        streak = 1
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        checkDate.setDate(checkDate.getDate() - 1)
      }
      
      // Count consecutive days
      for (let i = 0; i < allReviews.length; i++) {
        const reviewForDay = allReviews.find(r => {
          const rDate = new Date(r.date)
          rDate.setHours(0, 0, 0, 0)
          return rDate.getTime() === checkDate.getTime()
        })
        
        if (reviewForDay) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
      
      // Calculate bio metrics averages from recent reviews (last 7 days) using aggregation
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const bioMetricsAgg = await prisma.review.aggregate({
        where: {
          user_id: userId,
          date: {
            gte: sevenDaysAgo
          }
        },
        _avg: {
          spirit: true,
          energy: true,
          focus: true,
          creativity: true,
          emotion: true,
          social: true,
          focus_score: true,
          energy_score: true,
          mood_score: true
        }
      })
      
      const avgSpirit = bioMetricsAgg._avg.spirit || 0
      const avgEnergy = bioMetricsAgg._avg.energy || 0
      const avgFocus = bioMetricsAgg._avg.focus || 0
      const avgCreativity = bioMetricsAgg._avg.creativity || 0
      const avgEmotion = bioMetricsAgg._avg.emotion || 0
      const avgSocial = bioMetricsAgg._avg.social || 0
      const avgFocusScore = bioMetricsAgg._avg.focus_score || 0
      const avgEnergyScore = bioMetricsAgg._avg.energy_score || 0
      const avgMoodScore = bioMetricsAgg._avg.mood_score || 0
      
      // Get recent reviews (last 5) - combine with currentReview query
      const recentReviewsList = await prisma.review.findMany({
        where: {
          user_id: userId
        },
        select: {
          id: true,
          user_id: true,
          date: true,
          content: true,
          mood: true,
          achievements: true,
          improvements: true,
          plans: true,
          template_id: true,
          spirit: true,
          energy: true,
          focus: true,
          creativity: true,
          emotion: true,
          social: true,
          focus_score: true,
          energy_score: true,
          mood_score: true,
          prime_directive: true,
          system_interrupts: true,
          attachments: true,
          created_at: true,
          updated_at: true
        },
        orderBy: {
          date: 'desc'
        },
        take: 5
      })
      
      const parsedCurrentReview = currentReview ? normalizeReview(currentReview) : null
      const parsedRecentReviews = recentReviewsList.map(normalizeReview)
      
      return reply.status(200).send({
        success: true,
        data: {
          currentReview: parsedCurrentReview,
          streak,
          stats: {
            focus: Math.round(avgFocusScore),
            energy: Math.round(avgEnergyScore),
            mood: Math.round(avgMoodScore * 10) / 10
          },
          bioMetrics: {
            spirit: Math.round(avgSpirit * 10) / 10,
            energy: Math.round(avgEnergy * 10) / 10,
            focus: Math.round(avgFocus * 10) / 10,
            creativity: Math.round(avgCreativity * 10) / 10,
            emotion: Math.round(avgEmotion * 10) / 10,
            social: Math.round(avgSocial * 10) / 10
          },
          recentReviews: parsedRecentReviews
        },
        message: 'Review dashboard data retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Enhanced review creation with bio metrics
  app.post('/reviews/detailed', { preHandler: authenticate }, async (request, reply) => {
    const {
      date,
      content,
      mood,
      achievements,
      improvements,
      plans,
      template_id,
      // 生物指标（雷达图）
      spirit,
      energy,
      focus,
      creativity,
      emotion,
      social,
      // 统计数据
      focus_score,
      energy_score,
      mood_score,
      // 核心任务和阻碍
      prime_directive,
      system_interrupts,
      // 附件
      attachments
    } = request.body as {
      date: string
      content: string
      mood?: number
      achievements?: string[]
      improvements?: string[]
      plans?: string[]
      template_id?: number
      // 生物指标（雷达图）
      spirit?: number
      energy?: number
      focus?: number
      creativity?: number
      emotion?: number
      social?: number
      // 统计数据
      focus_score?: number
      energy_score?: number
      mood_score?: number
      // 核心任务和阻碍
      prime_directive?: string
      system_interrupts?: string
      // 附件
      attachments?: string[]
    }
    
    if (!date || !content) {
      return reply.status(400).send({ success: false, error: 'Missing required fields' })
    }
    
    try {
      // Check if review already exists for this date
      const existingReview = await prisma.review.findFirst({
        where: {
          user_id: (request.user as UserPayload).id,
          date: new Date(date)
        }
      })
      
      if (existingReview) {
        return reply.status(400).send({ success: false, error: 'Review already exists for this date' })
      }
      
      // Create review
      const review = await prisma.review.create({
        data: {
          user_id: (request.user as UserPayload).id,
          date: new Date(date),
          content,
          mood,
          achievements: achievements ? JSON.stringify(achievements) : null,
          improvements: improvements ? JSON.stringify(improvements) : null,
          plans: plans ? JSON.stringify(plans) : null,
          template_id,
          // 生物指标
          spirit,
          energy,
          focus,
          creativity,
          emotion,
          social,
          // 统计数据
          focus_score,
          energy_score,
          mood_score,
          // 核心任务和阻碍
          prime_directive,
          system_interrupts,
          // 附件
          attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments) : null
        }
      })
      
      return reply.status(201).send({
        success: true,
        data: normalizeReview(review),
        message: 'Review created successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Internal server error' })
    }
  })

  // Backup routes
  app.post('/backups', { preHandler: authenticate }, async (request, reply) => {
    const { type = 'manual' } = request.body as { type?: 'manual' | 'auto' }
    const userId = (request.user as UserPayload).id

    try {
      const backup = await backupService.createBackup(userId, type)

      return reply.status(201).send({
        success: true,
        data: backup,
        message: 'Backup created successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to create backup' })
    }
  })

  app.get('/backups', { preHandler: authenticate }, async (request, reply) => {
    const userId = (request.user as UserPayload).id

    try {
      const backups = await backupService.getBackupList(userId)

      return reply.status(200).send({
        success: true,
        data: backups,
        message: 'Backups retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to retrieve backups' })
    }
  })

  app.get('/backups/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = (request.user as UserPayload).id

    try {
      const backupData = await backupService.getBackupDetail(userId, id)

      if (!backupData) {
        return reply.status(404).send({ success: false, error: 'Backup not found' })
      }

      return reply.status(200).send({
        success: true,
        data: backupData,
        message: 'Backup detail retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to retrieve backup detail' })
    }
  })

  app.post('/backups/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { overwriteConflicts = false, restoreDeleted = true } = request.body as RestoreOptions
    const userId = (request.user as UserPayload).id

    try {
      await backupService.restoreBackup(userId, id, {
        overwriteConflicts,
        restoreDeleted,
      })

      return reply.status(200).send({
        success: true,
        message: 'Backup restored successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to restore backup' })
    }
  })

  app.delete('/backups/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = (request.user as UserPayload).id

    try {
      const success = await backupService.deleteBackup(userId, id)

      if (!success) {
        return reply.status(404).send({ success: false, error: 'Backup not found' })
      }

      return reply.status(200).send({
        success: true,
        message: 'Backup deleted successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to delete backup' })
    }
  })

  app.get('/backups/:id/download', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = (request.user as UserPayload).id

    try {
      const fileData = await backupService.downloadBackup(userId, id)

      if (!fileData) {
        return reply.status(404).send({ success: false, error: 'Backup not found' })
      }

      reply.type('application/json')
      reply.header('Content-Disposition', `attachment; filename="backup_${id}.json"`)
      return reply.send(fileData)
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to download backup' })
    }
  })

  // Backup scheduler routes (admin only)
  app.get('/backups/scheduler/status', { preHandler: authenticate }, async (request, reply) => {
    try {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: (request.user as UserPayload).id },
        select: { role: true } as any
      })

      if (!user || (user as any).role !== 'admin') {
        return reply.status(403).send({ success: false, error: 'Forbidden: Admin access required' })
      }

      // Get scheduler from server instance
      const { scheduler } = (app as any)

      if (!scheduler) {
        return reply.status(404).send({ success: false, error: 'Scheduler not initialized' })
      }

      const status = scheduler.getStatus()
      const taskStatus = scheduler.getTaskStatus()
      const history = scheduler.getTaskHistory(10)

      return reply.status(200).send({
        success: true,
        data: {
          scheduler: status,
          tasks: taskStatus,
          history
        },
        message: 'Scheduler status retrieved successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({ success: false, error: 'Failed to retrieve scheduler status' })
    }
  })

  app.post('/backups/scheduler/trigger', { preHandler: authenticate }, async (request, reply) => {
    const { taskId } = request.body as { taskId: string }

    if (!taskId) {
      return reply.status(400).send({ success: false, error: 'Missing required field: taskId' })
    }

    try {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: (request.user as UserPayload).id },
        select: { role: true } as any
      })

      if (!user || (user as any).role !== 'admin') {
        return reply.status(403).send({ success: false, error: 'Forbidden: Admin access required' })
      }

      // Get scheduler from server instance
      const { scheduler } = (app as any)

      if (!scheduler) {
        return reply.status(404).send({ success: false, error: 'Scheduler not initialized' })
      }

      await scheduler.triggerTask(taskId)

      return reply.status(200).send({
        success: true,
        message: 'Task triggered successfully'
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger task'
      })
    }
  })

  app.patch('/backups/scheduler/task/:taskId', { preHandler: authenticate }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const { enabled } = request.body as { enabled: boolean }

    if (enabled === undefined) {
      return reply.status(400).send({ success: false, error: 'Missing required field: enabled' })
    }

    try {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: (request.user as UserPayload).id },
        select: { role: true } as any
      })

      if (!user || (user as any).role !== 'admin') {
        return reply.status(403).send({ success: false, error: 'Forbidden: Admin access required' })
      }

      // Get scheduler from server instance
      const { scheduler } = (app as any)

      if (!scheduler) {
        return reply.status(404).send({ success: false, error: 'Scheduler not initialized' })
      }

      const success = scheduler.setTaskEnabled(taskId, enabled)

      if (!success) {
        return reply.status(404).send({ success: false, error: 'Task not found' })
      }

      return reply.status(200).send({
        success: true,
        message: `Task ${enabled ? 'enabled' : 'disabled'} successfully`
      })
    } catch (error) {
      app.log.error(error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task status'
      })
    }
  })
}
