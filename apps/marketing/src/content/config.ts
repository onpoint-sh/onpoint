import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).default([])
  })
})

const changelog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string().optional(),
    image: z.string().optional()
  })
})

export const collections = { blog, changelog }
