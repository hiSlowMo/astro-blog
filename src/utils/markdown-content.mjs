import { parse as parseHtml } from 'node-html-parser'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)

const directiveTitles = {
  note: 'NOTE',
  tip: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
}

function textNode(value) {
  return { type: 'text', value }
}

function getEmbedLink(node) {
  const { repo, id, url } = node.attributes ?? {}
  switch (node.name) {
    case 'github':
      return repo ? { label: `GitHub · ${repo}`, url: `https://github.com/${repo}` } : null
    case 'youtube':
      return id ? { label: 'YouTube', url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` } : null
    case 'bilibili':
      return id ? { label: '哔哩哔哩', url: `https://www.bilibili.com/video/${encodeURIComponent(id)}/` } : null
    default:
      return url ? { label: node.name, url } : null
  }
}

// Feed readers do not run the site's scripts: expand folds and keep embeds as links.
function remarkFeedContent() {
  return (tree) => {
    visit(tree, 'containerDirective', (node) => {
      const label = node.children[0]?.data?.directiveLabel ? node.children.shift() : null
      const title = label?.children ?? (directiveTitles[node.name] ? [textNode(directiveTitles[node.name])] : [])
      node.data = { hName: node.name === 'gallery' ? 'div' : 'blockquote' }
      if (title.length) {
        node.children.unshift({ type: 'paragraph', children: [{ type: 'strong', children: title }] })
      }
    })

    visit(tree, 'leafDirective', (node) => {
      const link = getEmbedLink(node)
      node.type = 'paragraph'
      node.children = link
        ? [{ type: 'link', url: link.url, children: [textNode(link.label)] }]
        : node.children?.length ? node.children : [textNode(node.name)]
      delete node.name
      delete node.attributes
    })

    visit(tree, 'textDirective', (node) => {
      node.data = { hName: 'span' }
    })

    visit(tree, 'blockquote', (node) => {
      const firstText = node.children[0]?.children?.[0]
      if (firstText?.type === 'text') {
        firstText.value = firstText.value.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '$1: ')
      }
    })

    visit(tree, 'image', (node) => {
      // Width hints belong to the site's layout, not the image's human-readable title.
      node.title = node.title?.replace(/(?:^|[\s,;|])(?:w|width|size)\s*=\s*[^\s,;|]+/gi, '').trim() || null
    })
  }
}

const feedProcessor = markdownParser()
  .use(remarkFeedContent)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true })

export function renderFeedMarkdown(markdown) {
  return String(feedProcessor.processSync(markdown))
}

function getVisibleText(node) {
  if (['code', 'inlineCode', 'image', 'imageReference', 'definition', 'leafDirective'].includes(node.type)) {
    return ''
  }
  if (node.type === 'link') {
    const label = node.children.map(child => getVisibleText(child)).join('')
    if (label === node.url || `mailto:${label}` === node.url || `http://${label}` === node.url) {
      return ''
    }
  }
  if (node.type === 'html') {
    const html = parseHtml(node.value)
    html.querySelectorAll('script, style').forEach(element => element.remove())
    return html.textContent
  }
  if (node.type === 'text') {
    return node.value.replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '')
  }
  // Inline formatting must not split a word, while block boundaries must separate words.
  return (node.children ?? []).map(child => getVisibleText(child)).join(['paragraph', 'heading', 'link', 'strong', 'emphasis', 'delete'].includes(node.type) ? '' : ' ')
}

/** Chinese characters + English/number words; omit code, URLs and image metadata. */
export function countMarkdownWords(markdown) {
  const text = getVisibleText(markdownParser.parse(markdown))
  const cjk = (text.match(/\p{Script=Han}/gu) ?? []).length
  const enWords = (text.match(/[a-z0-9]+(?:['’][a-z0-9]+)*/gi) ?? []).length
  return { cjk, enWords, total: cjk + enWords }
}
