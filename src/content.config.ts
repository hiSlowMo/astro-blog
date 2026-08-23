import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'
import { allLocales, themeConfig } from '@/config'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    // required
    title: z.string(),
    published: z.date(),
    // optional
    description: z.string().optional().default(''),
    updated: z.preprocess(
      val => val === '' ? undefined : val,
      z.date().optional(),
    ),
    tags: z.array(z.string()).optional().default([]),
    categories: z.array(z.string()).optional().default([]),
    // Structured content helpers for future expansion
    series: z.preprocess(
      val => val === '' || val == null ? undefined : val,
      z.string().optional(),
    ).default(''),
    featured: z.boolean().optional().default(false),
    cover: z.preprocess(
      val => val === '' || val == null ? undefined : val,
      z.string().optional(),
    ).default(''),
    status: z.preprocess(
      val => val === '' || val == null ? undefined : val,
      z.enum(['idea', 'ongoing', 'paused', 'completed']).optional(),
    ),
    // Advanced
    visibility: z.enum(['public', 'private']).optional().default('public'),
    draft: z.boolean().optional().default(false),
    pin: z.number().int().min(0).max(99).optional().default(0),
    toc: z.boolean().optional().default(themeConfig.global.toc),
    lang: z.enum(['', ...allLocales]).optional().default(''),
    abbrlink: z.string().optional().default('').refine(
      abbrlink => !abbrlink || /^[a-z0-9\-]*$/.test(abbrlink),
      { message: 'Abbrlink can only contain lowercase letters, numbers and hyphens' },
    ),
  }),
})

const about = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/about' }),
  schema: z.object({
    lang: z.enum(['', ...allLocales]).optional().default(''),
  }),
})

const moments = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/moments' }),
  schema: z.object({
    published: z.date(),
    draft: z.boolean().optional().default(false),
  }),
})

export const collections = { posts, about, moments }
