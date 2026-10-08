import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const postsDir = path.resolve('src/content/posts')
const outDir = path.resolve('src/generated')
const outFile = path.join(outDir, 'stats.json')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory())
      files.push(...walk(p))
    else files.push(p)
  }
  return files
}

function stripFrontmatter(md) {
  // remove leading --- ... --- frontmatter
  if (md.startsWith('---')) {
    const idx = md.indexOf('\n---', 3)
    if (idx !== -1)
      return md.slice(idx + 4)
  }
  return md
}

// 与站点保持一致：草稿和私密文章不计入公开统计
function isPublicPost(md) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)
  if (!match)
    return true
  const frontmatter = match[1]
  const isDraft = /^draft:\s*true\s*$/m.test(frontmatter)
  const isPrivate = /^visibility:\s*['"]?private['"]?\s*$/m.test(frontmatter)
  return !isDraft && !isPrivate
}

function countCJKAndWords(text) {
  // 简单：中文按字符算；英文按单词算
  const cjk = (text.match(/[\u4E00-\u9FFF]/g) || []).length
  const enWords = (text.match(/[a-z0-9]+(?:'[a-z0-9]+)?/gi) || []).length
  return { cjk, enWords }
}

if (!fs.existsSync(postsDir)) {
  console.error('找不到 posts 目录：', postsDir)
  process.exit(1)
}

const mdFiles = walk(postsDir).filter(f => /\.mdx?$/i.test(f))

let totalPosts = 0
let totalCJK = 0
let totalEnWords = 0

for (const file of mdFiles) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!isPublicPost(raw))
    continue
  totalPosts++
  const body = stripFrontmatter(raw)
  const { cjk, enWords } = countCJKAndWords(body)
  totalCJK += cjk
  totalEnWords += enWords
}

const now = new Date()
const stats = {
  posts: totalPosts,
  totalCJKChars: totalCJK,
  totalEnglishWords: totalEnWords,
  updatedAt: now.toISOString(),
  updatedAtLocal: now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).replace(/\//g, '-'),
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(stats, null, 2)}\n`, 'utf8')

console.warn('✅ stats generated:', outFile)
console.warn(stats)
