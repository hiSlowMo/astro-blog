import { visit } from 'unist-util-visit'

export function rehypeMermaidSource() {
  return (tree) => {
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'code' || !parent) {
        return
      }

      const className = node.properties?.className
      const isMermaid = Array.isArray(className)
        ? className.includes('language-mermaid')
        : className === 'language-mermaid'

      if (!isMermaid) {
        return
      }

      const text = node.children
        ?.filter(child => child.type === 'text')
        .map(child => child.value)
        .join('') ?? ''

      const container = parent.type === 'element' && parent.tagName === 'pre'
        ? parent
        : node

      container.tagName = 'pre'
      container.properties = { className: ['mermaid'] }
      container.children = [{ type: 'text', value: text }]
    })
  }
}
