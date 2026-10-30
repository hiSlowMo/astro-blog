/**
 * Create a new moment with frontmatter
 * Usage:
 *   pnpm new-moment
 *   pnpm new-moment "今天发生了一件小事"
 *   pnpm new-moment --draft "还没写完的说说"
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const momentsDir = 'src/content/moments'
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  pnpm new-moment [--draft] [content]

Examples:
  pnpm new-moment
  pnpm new-moment "今天发生了一件小事"
  pnpm new-moment --draft "还没写完的说说"`)
  process.exit(0)
}

const draft = args.includes('--draft')
const content = args
  .filter(arg => arg !== '--draft')
  .join(' ')
  .trim()

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
  .formatToParts(new Date())
  .reduce<Record<string, string>>((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value
    }
    return parts
  }, {})

const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`
const time = `${dateParts.hour}${dateParts.minute}${dateParts.second}`
const published = `${date}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}+08:00`

mkdirSync(momentsDir, { recursive: true })

const baseName = `${date}-${time}`
let fullPath = join(momentsDir, `${baseName}.md`)
let suffix = 2

while (existsSync(fullPath)) {
  fullPath = join(momentsDir, `${baseName}-${suffix}.md`)
  suffix++
}

const fileContent = `---
published: ${published}
draft: ${draft}
---

${content ? `${content}\n` : ''}`

try {
  writeFileSync(fullPath, fileContent, 'utf8')
  console.log(`✅ Moment created: ${fullPath}`)
}
catch (error) {
  console.error('❌ Failed to create moment:', error)
  process.exit(1)
}
