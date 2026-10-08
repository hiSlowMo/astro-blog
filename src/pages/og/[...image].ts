import type { CollectionEntry } from 'astro:content'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { OGImageRoute } from 'astro-og-canvas'
import { getCollection } from 'astro:content'
import { shouldIncludePost } from '@/utils/content'
import { getPostDescription } from '@/utils/description'

// eslint-disable-next-line antfu/no-top-level-await
const posts = await getCollection('posts', ({ data }) => shouldIncludePost(data, import.meta.env.DEV))
const ogCoverCacheDir = path.resolve(process.cwd(), 'node_modules/.astro-og-canvas/cover-cache')

async function resolveCoverImagePath(cover: string) {
  if (!cover) {
    return ''
  }

  if (cover.startsWith('/')) {
    const localPath = path.resolve(process.cwd(), 'public', cover.replace(/^\/+/, ''))
    try {
      await fs.access(localPath)
      return localPath
    }
    catch {
      return ''
    }
  }

  if (!/^https?:\/\//.test(cover)) {
    return ''
  }

  const url = new URL(cover)
  const ext = path.extname(url.pathname) || '.img'
  const filename = `${createHash('sha1').update(cover).digest('hex')}${ext}`
  const cachedPath = path.join(ogCoverCacheDir, filename)

  try {
    await fs.access(cachedPath)
    return cachedPath
  }
  catch {}

  const response = await fetch(cover, {
    headers: {
      'Referer': 'https://theslowmo.com/',
      'User-Agent': 'Mozilla/5.0',
    },
  })
  if (!response.ok) {
    console.warn(`[OG] Failed to fetch cover: ${response.status} ${response.statusText} ${cover}`)
    return ''
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.mkdir(ogCoverCacheDir, { recursive: true })
  await fs.writeFile(cachedPath, buffer)
  return cachedPath
}

// Create slug-to-metadata lookup object for blog posts
const pages = Object.fromEntries(
  posts.map((post: CollectionEntry<'posts'>) => [
    post.id,
    {
      title: post.data.title,
      description: getPostDescription(post, 'og'),
      cover: post.data.cover,
    },
  ]),
)

// Configure Open Graph image generation route
// eslint-disable-next-line antfu/no-top-level-await
export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'image',
  pages,
  getImageOptions: async (_path, page) => {
    const coverPath = await resolveCoverImagePath(page.cover || '')
    const hasCover = Boolean(coverPath)

    return {
      title: page.title,
      description: page.description,
      logo: {
        path: './public/icons/og-logo.png', // Required local path and PNG format
        size: [250],
      },
      border: {
        color: hasCover ? [216, 226, 235] : [242, 241, 245],
        width: 20,
      },
      font: {
        title: {
          families: ['Noto Sans SC'],
          weight: 'Bold',
          color: hasCover ? [246, 246, 250] : [34, 33, 36],
          lineHeight: 1.5,
        },
        description: {
          families: ['Noto Sans SC'],
          color: hasCover ? [228, 232, 238] : [72, 71, 74],
          lineHeight: 1.5,
        },
      },
      fonts: [
        './public/fonts/NotoSansSC-Bold.otf',
        './public/fonts/NotoSansSC-Regular.otf',
      ],
      bgGradient: hasCover ? [[28, 30, 38]] : [[242, 241, 245]],
      ...(hasCover
        ? {
            bgImage: {
              path: coverPath,
              fit: 'cover' as const,
              position: 'center' as const,
            },
          }
        : {}),
    }
  },
})
