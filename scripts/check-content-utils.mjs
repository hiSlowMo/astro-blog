import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from 'node-html-parser'
import sanitizeHtml from 'sanitize-html'
import { countMarkdownWords, renderFeedMarkdown } from '../src/utils/markdown-content.mjs'
import { groupPostsByYear } from '../src/utils/post-groups.mjs'

test('word counts preserve link text and omit URLs, code and image metadata', () => {
  const markdown = [
    '你好 [Hello world](https://example.com/秘密) 世界',
    '`secret 中文`',
    '```js\nconst hidden = "中文"\n```',
    '![图片说明](https://example.com/image.webp "width=78%")',
    '<https://example.com/秘密>',
    'www.example.com',
    '<me@example.com>',
    '<!-- 隐藏文字 -->',
  ].join('\n\n')
  assert.deepEqual(countMarkdownWords(markdown), { cjk: 4, enWords: 2, total: 6 })
})

test('inline formatting does not split English words', () => {
  assert.deepEqual(countMarkdownWords('Slow**Mo** 中文 <span>Hello</span>'), { cjk: 2, enWords: 2, total: 4 })
})

test('word counts understand directive titles and supplementary Chinese characters', () => {
  assert.deepEqual(countMarkdownWords(':::tip[提示]\n𠮷与中文 Hello\n:::'), { cjk: 6, enWords: 1, total: 7 })
  assert.deepEqual(countMarkdownWords('::github{repo="hiSlowMo/astro-blog"}'), { cjk: 0, enWords: 0, total: 0 })
})

function feedDocument(markdown) {
  return parse(sanitizeHtml(renderFeedMarkdown(markdown), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'ruby', 'rt', 'rp']),
  }))
}

test('feeds expand nested folds and retain titles, body and ordinary links', () => {
  const doc = feedDocument([
    '::::fold[阅读更多]',
    '开头 [博客](https://example.com)',
    ':::tip[注意]',
    '嵌套内容。',
    ':::',
    '结尾。',
    '::::',
  ].join('\n\n'))
  for (const text of ['阅读更多', '开头', '博客', '注意', '嵌套内容。', '结尾。'])
    assert.ok(doc.textContent.includes(text), `Missing fold content: ${text}`)
  assert.equal(doc.querySelector('a').getAttribute('href'), 'https://example.com')
  assert.ok(!doc.textContent.includes(':::'))
})

test('feeds turn script-based embeds into useful links', () => {
  const doc = feedDocument([
    '::github{repo="hiSlowMo/astro-blog"}',
    '::youtube{id="video-id"}',
    '::bilibili{id="BV123"}',
    '::tweet{url="https://x.com/example/status/1"}',
    '::spotify{url="https://open.spotify.com/track/example"}',
  ].join('\n\n'))
  assert.deepEqual(doc.querySelectorAll('a').map(link => link.getAttribute('href')), [
    'https://github.com/hiSlowMo/astro-blog',
    'https://www.youtube.com/watch?v=video-id',
    'https://www.bilibili.com/video/BV123/',
    'https://x.com/example/status/1',
    'https://open.spotify.com/track/example',
  ])
  assert.ok(doc.textContent.includes('hiSlowMo/astro-blog'))
})

test('feeds remove layout hints while preserving images and human-readable titles', () => {
  const doc = feedDocument([
    '![图片说明](https://example.com/a.webp "width=78%")',
    '![第二张](https://example.com/b.webp "A photograph")',
  ].join('\n\n'))
  const images = doc.querySelectorAll('img')
  assert.equal(images.length, 2)
  assert.equal(images[0].getAttribute('alt'), '图片说明')
  assert.equal(images[0].getAttribute('title'), undefined)
  assert.equal(images[1].getAttribute('title'), 'A photograph')
})

test('feeds retain Ruby annotations and fallback brackets', () => {
  const doc = feedDocument('不像『<ruby>月がきれい<rp>（</rp><rt>月色真美</rt><rp>）</rp></ruby>』。')
  assert.equal(doc.querySelector('ruby rt').textContent, '月色真美')
  assert.equal(doc.querySelectorAll('rp').length, 2)
  assert.ok(doc.textContent.includes('月がきれい'))
})

test('feeds keep directive examples inside code and sanitize unsafe HTML and URLs', () => {
  const doc = feedDocument('```md\n:::tip\n示例\n:::\n```\n\n::tweet{url="javascript:alert(1)"}\n\n<script>alert(1)</script>')
  assert.ok(doc.querySelector('pre').textContent.includes(':::tip'))
  assert.equal(doc.querySelector('script'), null)
  assert.equal(doc.querySelector('a[href]'), null)
})

test('archives include pinned posts once, while the home regular list excludes them', () => {
  const older = { id: 'older', data: { published: new Date('2025-12-01'), pin: 0 } }
  const pinned = { id: 'pinned', data: { published: new Date('2026-01-01'), pin: 1 } }
  const latest = { id: 'latest', data: { published: new Date('2026-02-01'), pin: 0 } }
  const posts = [older, pinned, latest]
  const archive = groupPostsByYear(posts, { includePinned: true })
  assert.deepEqual([...archive.keys()], [2026, 2025])
  assert.deepEqual([...archive.values()].flat().map(post => post.id), ['latest', 'pinned', 'older'])
  assert.deepEqual([...groupPostsByYear(posts).values()].flat().map(post => post.id), ['latest', 'older'])
  assert.deepEqual(posts.map(post => post.id), ['older', 'pinned', 'latest'])
})
