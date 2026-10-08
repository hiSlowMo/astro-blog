import { visit } from 'unist-util-visit'

const IGNORE_TAGS = new Set(['pre', 'table'])
const IGNORE_CLASS_HINTS = [
  'code-block-wrapper',
  'mermaid',
  'katex',
  'twitter-tweet',
  'giscus',
  'twikoo',
]

function toClassList(value) {
  if (!value)
    return []
  if (Array.isArray(value)) {
    return value.flatMap(item => String(item).split(' '))
  }
  return String(value).split(' ')
}

export function rehypePagefindOptimize() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      const classes = toClassList(node.properties?.className)
      const hitClass = classes.some(cls => IGNORE_CLASS_HINTS.some(hint => cls.includes(hint)))
      const hitTag = IGNORE_TAGS.has(node.tagName)

      if (!hitClass && !hitTag)
        return

      node.properties = node.properties || {}
      node.properties['data-pagefind-ignore'] = 'all'
    })
  }
}
