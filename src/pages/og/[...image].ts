import type { APIRoute, GetStaticPaths } from 'astro'
import type { ShareCard } from '@/data/share-cards'
import type { SharePage } from '@/utils/share-image'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getCollection } from 'astro:content'
import { shareCards } from '@/data/share-cards'
import { shouldIncludePost } from '@/utils/content'
import { getPostDescription } from '@/utils/description'
import { renderShareImage } from '@/utils/share-image'

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
    signal: AbortSignal.timeout(8000),
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

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => shouldIncludePost(data, import.meta.env.DEV))
  return [
    ...posts.map(post => ({
      params: { image: `${post.id}.png` },
      props: { title: post.data.title, description: getPostDescription(post, 'og'), published: post.data.published, cover: post.data.cover },
    })),
    ...Object.entries(shareCards).map(([key, card]) => ({
      params: { image: `brand/${key}.png` },
      props: { ...card, brand: key as ShareCard },
    })),
  ]
}

export const GET: APIRoute<SharePage> = async ({ props }) => {
  const cover = props.cover ? await resolveCoverImagePath(props.cover).catch(() => '') : ''
  const image = await renderShareImage(props, cover)
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } })
}
