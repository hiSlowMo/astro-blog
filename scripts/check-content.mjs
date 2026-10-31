import { readFileSync } from 'node:fs'
import process from 'node:process'

const checks = [
  {
    file: 'dist/posts/2026年的第一篇实质性博客/index.html',
    text: '基础设施搭完了',
    label: '普通文章正文',
  },
  {
    file: 'dist/about/index.html',
    text: '你好，这里是开场白',
    label: '关于页正文',
  },
  {
    file: 'dist/moments/index.html',
    text: '我已痛得没了知觉没了解',
    label: '说说正文',
  },
]

const failures = []

for (const check of checks) {
  const html = readFileSync(check.file, 'utf8')
  if (!html.includes(check.text)) {
    failures.push(`${check.label}未渲染：${check.file}`)
  }
  if (html.includes('undefined 分钟')) {
    failures.push(`阅读时间未生成：${check.file}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Content regression passed: post, moment, about page, and reading time.')
