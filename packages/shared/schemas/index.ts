import { z } from 'zod'

export const AuthSchema = {
  register: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6)
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string()
  }),
  forgotPassword: z.object({
    email: z.string().email()
  }),
  resetPassword: z.object({
    token: z.string(),
    password: z.string().min(6)
  })
}

export const NoteSchema = {
  create: z.object({
    title: z.string().min(1).max(200),
    content: z.string(),
    folder_id: z.number().optional(),
    is_pinned: z.boolean().optional()
  }),
  update: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().optional(),
    folder_id: z.number().optional(),
    is_pinned: z.boolean().optional()
  })
}

export const FolderSchema = {
  create: z.object({
    name: z.string().min(1).max(100)
  }),
  update: z.object({
    name: z.string().min(1).max(100)
  })
}

export const ReviewSchema = {
  create: z.object({
    date: z.string().datetime(),
    content: z.string(),
    mood: z.number().min(1).max(10).optional(),
    achievements: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    plans: z.array(z.string()).optional(),
    template_id: z.number().optional()
  }),
  update: z.object({
    date: z.string().datetime().optional(),
    content: z.string().optional(),
    mood: z.number().min(1).max(10).optional(),
    achievements: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    plans: z.array(z.string()).optional(),
    template_id: z.number().optional()
  })
}