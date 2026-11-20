import { createHash } from 'node:crypto'
import { formatPostDate } from './date'

export function releaseSleeveArtwork(title: string, published: Date) {
  const normalized = title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
  const [palette, layout] = createHash('sha256').update(normalized).digest()
  const personal = /周记|随笔|思考|日记|杂记|近况|感悟|反思|回忆/.test(normalized)
  const technical = /教程|部署|配置|搭建|接入|接上|构建|实现|安装|迁移|自动化|开发|设计/.test(normalized)
  const lower = personal || (!technical && layout % 2 === 1)
  const radius = lower ? 74 : 100
  const colors = ['#a9bcad', '#d6ba99', '#aabac5', '#c5b4b9', '#cccaab']
  const grooves = [34, 39, 41, 47, 52, 58, 60, 66, 72, 77, 79, 85, 89]
  const date = formatPostDate(published, 'YYYY-MM-DD').replaceAll('-', '')
  return `<rect width="160" height="160" fill="#e6e1d5"/>
    <g transform="translate(${lower ? '75 136' : '127 132'})">
      <circle r="${radius}" fill="#20211f"/>
      <g fill="none" stroke="#555650" stroke-width=".75">${grooves.map(groove => `<circle r="${(radius * groove / 92).toFixed(2)}"/>`).join('')}</g>
      <circle r="${lower ? 20 : 24}" fill="${colors[palette % colors.length]}"/>
      <circle r="2.5" fill="#20211f"/>
    </g>
    <g class="sleeve-wordmark" fill="#262723" font-family="sans-serif" font-weight="700" font-size="12" letter-spacing="-.5">
      <text x="10" y="15">THE</text><text class="sleeve-name" x="10" y="32" font-size="20" font-weight="800" letter-spacing="-1">SLOWMO</text><text x="10" y="45">RECORDS</text>
    </g><text class="sleeve-date" x="10" y="58" fill="#555650" font-size="7" font-family="monospace">${date}</text>`
}
