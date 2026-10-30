import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as pagefind from 'pagefind'
import { createBlogSearch, getSearchTerms, highlightSearchText } from '../src/scripts/search-query.mjs'

const directory = await mkdtemp(join(tmpdir(), 'blog-search-check-'))
const originalFetch = globalThis.fetch
let api
try {
  await writeFile(join(directory, 'package.json'), '{"type":"module"}')
  const created = await pagefind.createIndex({ forceLanguage: 'zh' })
  assert.deepEqual(created.errors, [])
  const records = {
    greeting: '你好，世界。',
    separate: '你是一名学生，今天很好。',
    berry: '树莓是一种水果。',
    pi: '我把树莓派放在书桌上。',
    assistant: '树莓派上的 OpenClaw 助理。',
    english: 'Hermes is an AI assistant.',
  }
  for (const [title, content] of Object.entries(records)) {
    const result = await created.index.addCustomRecord({
      url: `/${title}/`,
      content,
      language: 'zh',
      meta: { title },
    })
    assert.deepEqual(result.errors, [])
  }
  const output = join(directory, 'pagefind')
  const written = await created.index.writeFiles({ outputPath: output })
  assert.deepEqual(written.errors, [])

  // Run the actual generated search engine in Node, reading its local index files.
  globalThis.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input)
    if (url.startsWith('file:'))
      return new Response(await readFile(new URL(url)))
    return originalFetch(input, options)
  }
  api = await import(pathToFileURL(join(output, 'pagefind.js')))
  await api.options({ baseUrl: '/' })
  const search = createBlogSearch(api)
  const cases = [
    ['你好', ['/greeting/']],
    ['"你好"', ['/greeting/']],
    ['你好呀', []],
    ['树莓派', ['/assistant/', '/pi/']],
    ['树莓泡', []],
    ['树莓派火星', []],
    ['树莓派 OpenClaw', ['/assistant/']],
    ['你 好', ['/greeting/', '/separate/']],
    ['HERMES', ['/english/']],
    ['', []],
  ]
  for (const [query, expected] of cases) {
    const results = await search(query)
    assert.deepEqual(results.map(result => result.url).sort(), expected, query)
  }
  for (const query of ['你好', '树莓派']) {
    const results = await search(query)
    for (const result of results) {
      const highlights = highlightSearchText(result.excerpt, getSearchTerms(query))
        .filter(segment => segment.match)
        .map(segment => segment.text)
      assert.ok(highlights.includes(query), `${query}: highlight the whole phrase`)
    }
  }
  console.log(`Search regression passed: ${cases.length} queries and complete Chinese highlights.`)
}
finally {
  globalThis.fetch = originalFetch
  await api?.destroy()
  await pagefind.close()
  await rm(directory, { recursive: true, force: true })
}
