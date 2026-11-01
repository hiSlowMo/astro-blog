import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parse as parseYaml } from 'yaml'
import { countMarkdownWords } from '../utils/markdown-content.mjs'

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

function parsePost(md) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(md)
  return match
    ? { data: parseYaml(match[1]) ?? {}, body: md.slice(match[0].length) }
    : { data: {}, body: md }
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
  const { data, body } = parsePost(raw)
  if (data.draft || data.visibility === 'private')
    continue
  totalPosts++
  const { cjk, enWords } = countMarkdownWords(body)
  totalCJK += cjk
  totalEnWords += enWords
}

const now = new Date()
const stats = {
  posts: totalPosts,
  totalCJKChars: totalCJK,
  totalEnglishWords: totalEnWords,
  totalWords: totalCJK + totalEnWords,
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
