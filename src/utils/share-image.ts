import type { OverlayOptions } from 'sharp'
import type { ShareCard } from '@/data/share-cards'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import sharp from 'sharp'
import indexGlyphs from '@/assets/og-index-glyphs.svg?raw'
import recordsPrefix from '@/assets/records-wordmark-prefix.svg?raw'
import recordsTitle from '@/assets/records-wordmark-title.svg?raw'
import { editorialDesign } from '@/data/editorial-design'
import { friendLinks, siteProfile } from '@/data/friend-links'
import { releaseSleeveArtwork } from './release-sleeve'

const ink = '#171916'
const paper = '#eeeae1'
const muted = '#b9bdb6'

function svg(width: number, height: number, contents: string, viewBox = `0 0 ${width} ${height}`) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${contents}</svg>`)
}

async function lettering(value: string, size: number, width: number, color: string, face: 'regular' | 'bold' = 'regular') {
  const text = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const bold = face === 'bold'
  return sharp({ text: {
    text: `<span foreground="${color}">${text}</span>`,
    font: `Noto Sans SC${bold ? ' Bold' : ''} ${size}`,
    fontfile: path.resolve('assets/fonts/og', `NotoSansSC-${bold ? 'Bold' : 'Regular'}.otf`),
    width,
    wrap: 'word-char',
    rgba: true,
  } }).png().toBuffer({ resolveWithObject: true })
}

async function asciiPortrait() {
  const columns = 58
  const rows = 32
  const pixels = await sharp('src/assets/portrait.png').resize(columns, rows, { fit: 'fill' }).greyscale().raw().toBuffer()
  const glyphs = ' .:-=+*#%@'
  const lines = Array.from({ length: rows }, (_, row) => {
    let line = ''
    for (const pixel of pixels.subarray(row * columns, (row + 1) * columns))
      line += glyphs[Math.round((1 - pixel / 255) ** 0.65 * (glyphs.length - 1))]
    return `<text x="0" y="${13 + row * 12}">${line}</text>`
  })
  return svg(414, 390, `<g xml:space="preserve" font-family="monospace" font-size="12" fill="#a4ada5">${lines.join('')}</g>`)
}

export interface SharePage {
  title: string
  description: string
  published?: Date
  cover?: string
  brand?: ShareCard
}

export async function renderShareImage(page: SharePage, coverPath: string) {
  const records = page.brand === 'records' || page.brand === 'submit'
  const foreground = records ? ink : paper
  const secondary = records ? '#53574f' : muted
  const layers: OverlayOptions[] = []
  async function text(value: string, left: number, top: number, size: number, width: number, color = foreground, face: 'regular' | 'bold' = 'regular') {
    const { data, info } = await lettering(value, size, width, color, face)
    layers.push({ input: data, left, top })
    return info
  }
  const rule = editorialDesign.masthead * 2
  layers.push({ input: svg(1072, rule, `<rect width="1072" height="${rule}" fill="${foreground}"/>`), left: 64, top: 54 })
  await text(page.brand === 'home' ? 'theslowmo.com' : siteProfile.name, 64, 78, 23, 680, foreground, 'bold')
  const runningLabel = page.published?.toISOString().slice(0, 10).replaceAll('-', ' / ')
    || (page.brand === 'submit' ? 'SUBMIT AN ALBUM' : records ? `${String(friendLinks.length).padStart(2, '0')} RECORDS` : '')
  if (runningLabel) {
    const advance = 600
    const scale = 22 / 1000
    const glyphs = Array.from(runningLabel, (char, index) => char === ' ' ? '' : `<use xlink:href="#g${char.codePointAt(0)}" x="${advance * index}"/>`).join('')
    const width = Math.ceil(runningLabel.length * advance * scale)
    const label = svg(width, 26, `${indexGlyphs}<g xmlns:xlink="http://www.w3.org/1999/xlink" transform="translate(0 20) scale(${scale} ${-scale})" fill="${secondary}">${glyphs}</g>`)
    layers.push({ input: label, left: 1136 - width, top: 77 })
  }

  if (page.brand === 'home') {
    const [name, office] = page.title.split(' ')
    await text(name, 59, 171, 109, 640, foreground, 'bold')
    if (office)
      await text(office, 60, 297, 100, 630, foreground, 'bold')
    await text(page.description, 66, 481, 34, 670)
    await text('Our minds are wider than the sky.', 67, 535, 23, 670, muted)
    layers.push({ input: await asciiPortrait(), left: 717, top: 160 })
  }
  else if (records) {
    const submit = page.brand === 'submit'
    const [first, word] = await Promise.all([recordsPrefix, recordsTitle].map(mark =>
      sharp(Buffer.from(mark), { density: 160 })
        .trim({ background: '#00000000' })
        .resize({ height: submit ? 38 : 84 })
        .png()
        .toBuffer({ resolveWithObject: true }),
    ))
    layers.push({ input: first.data, left: 62, top: submit ? 171 : 178 })
    const left = submit ? 62 + first.info.width + 18 : 64
    const top = submit ? 161 : 297
    const width = word.info.width + 56
    const height = word.info.height + 31
    const inset = height * Math.tan(editorialDesign.cutAngle * Math.PI / 180)
    layers.push({ input: svg(width, height, `<path d="M0 0H${width}L${width - inset} ${height}H0Z" fill="${ink}"/>`), left, top })
    layers.push({ input: word.data, left: left + 12, top: top + 14 })
    if (submit)
      await text(page.title, 60, 282, 96, 1072, foreground, 'bold')
    await text(submit ? '提交你的博客，加入友链唱片目录。' : '这排唱片架上，每张专辑都是一个独立博客。', 65, 488, 32, 1065)
    if (!submit)
      await text('A RECORD STORE FOR THE INDEPENDENT WEB.', 66, 540, 22, 1060, secondary)
  }
  else if (page.published) {
    let cover: Buffer | undefined
    if (coverPath) {
      try {
        cover = await sharp(coverPath).rotate().resize(308, 308, { fit: 'cover' }).png().toBuffer()
      }
      catch {}
    }
    layers.push({
      input: cover || svg(308, 308, releaseSleeveArtwork(page.title, page.published), '0 0 160 160'),
      left: 828,
      top: 169,
    })
    let size = 67
    const titleHeight = Array.from(page.title).length <= 44 ? 158 : 241
    let title = await lettering(page.title, size, 720, foreground, 'bold')
    while (title.info.height > titleHeight && size > 27) {
      size -= 4
      title = await lettering(page.title, size, 720, foreground, 'bold')
    }
    const titleImage = title.info.height > titleHeight ? await sharp(title.data).resize({ height: titleHeight }).png().toBuffer() : title.data
    layers.push({ input: titleImage, left: 62, top: 165 })
    if (page.description) {
      const description = await lettering(page.description, 27, 720, muted)
      const top = 165 + Math.min(titleHeight, title.info.height) + 40
      const input = description.info.height > 570 - top ? await sharp(description.data).resize({ height: 570 - top }).png().toBuffer() : description.data
      layers.push({ input, left: 65, top })
    }
  }
  return sharp({ create: { width: 1200, height: 630, channels: 3, background: records ? paper : ink } })
    .composite(layers)
    .png()
    .toBuffer()
}
