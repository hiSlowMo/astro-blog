import { visit } from 'unist-util-visit'

const SIZE_KEYWORD_MAP = {
  sm: '40%',
  md: '60%',
  lg: '80%',
  full: '100%',
}

function isElement(node, tagName) {
  return node?.type === 'element' && node.tagName === tagName
}

function isWhitespaceText(node) {
  return node?.type === 'text' && node.value.trim() === ''
}

function normalizeCssSize(value) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (SIZE_KEYWORD_MAP[normalized]) {
    return SIZE_KEYWORD_MAP[normalized]
  }

  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return `${normalized}px`
  }

  if (/^\d+(?:\.\d+)?(?:px|%|rem|em|vw|vh|vmin|vmax|ch|ex)$/.test(normalized)) {
    return normalized
  }

  return null
}

function parseImageOptions(imgNode) {
  const title = imgNode.properties?.title
  if (typeof title !== 'string' || !title.trim()) {
    return {}
  }

  const widthMatch = title.match(/(?:^|[\s,;|])(?:w|width|size)\s*=\s*([^\s,;|]+)/i)
  const width = normalizeCssSize(widthMatch?.[1])

  if (!width) {
    return {}
  }

  delete imgNode.properties.title

  return { width }
}

function trimParagraphChildren(children) {
  const trimmedChildren = [...children]

  while (trimmedChildren[0] && isWhitespaceText(trimmedChildren[0])) {
    trimmedChildren.shift()
  }

  while (trimmedChildren.at(-1) && isWhitespaceText(trimmedChildren.at(-1))) {
    trimmedChildren.pop()
  }

  if (trimmedChildren[0]?.type === 'text') {
    trimmedChildren[0].value = trimmedChildren[0].value.replace(/^\s+/, '')
  }

  if (trimmedChildren.at(-1)?.type === 'text') {
    trimmedChildren.at(-1).value = trimmedChildren.at(-1).value.replace(/\s+$/, '')
  }

  return trimmedChildren.filter((child, index, list) => {
    if (!isWhitespaceText(child)) {
      return true
    }

    const prev = list[index - 1]
    const next = list[index + 1]
    return !!prev && !!next
  })
}

function createParagraph(children) {
  const paragraphChildren = trimParagraphChildren(children)
  if (paragraphChildren.length === 0) {
    return null
  }

  return {
    type: 'element',
    tagName: 'p',
    properties: {},
    children: paragraphChildren,
  }
}

function createFigure(imgNode, isInGallery = false) {
  const altText = imgNode.properties?.alt
  const { width } = parseImageOptions(imgNode)
  const shouldSkipCaption = !altText || altText.startsWith('_')
  const shouldWrapImage = isInGallery || !shouldSkipCaption || !!width

  if (!shouldWrapImage) {
    return imgNode
  }

  const children = [imgNode]

  if (!shouldSkipCaption) {
    children.push({
      type: 'element',
      tagName: 'figcaption',
      properties: {},
      children: [{ type: 'text', value: altText }],
    })
  }

  const properties = isInGallery ? { className: ['gallery-item'] } : {}

  if (width) {
    properties['data-image-width'] = width
    properties.style = `--post-image-width: ${width};`
  }

  return {
    type: 'element',
    tagName: 'figure',
    properties,
    children,
  }
}

export function rehypeImageProcessor() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      // Skip non-paragraph elements, empty paragraphs, and orphaned nodes
      if (node.tagName !== 'p' || !node.children || node.children.length === 0 || !parent) {
        return
      }

      // Collect images from paragraph
      const imgNodes = []
      for (const child of node.children) {
        if (isElement(child, 'img')) {
          imgNodes.push(child)
        }
      }

      if (imgNodes.length === 0) {
        return
      }

      const isInGallery = parent?.properties?.className?.includes('gallery-container')
      const hasMixedContent = node.children.some(child => !isWhitespaceText(child) && !isElement(child, 'img'))

      // Gallery container: convert images to figures
      if (isInGallery) {
        const figures = imgNodes.map(imgNode => createFigure(imgNode, true))
        parent.children.splice(index, 1, ...figures)
        return
      }

      // Mixed paragraph: split surrounding text into paragraphs and images into figures
      if (hasMixedContent) {
        const splitNodes = []
        let currentParagraphChildren = []

        for (const child of node.children) {
          if (isElement(child, 'img')) {
            const paragraph = createParagraph(currentParagraphChildren)
            if (paragraph) {
              splitNodes.push(paragraph)
            }

            splitNodes.push(createFigure(child, false))
            currentParagraphChildren = []
            continue
          }

          currentParagraphChildren.push(child)
        }

        const trailingParagraph = createParagraph(currentParagraphChildren)
        if (trailingParagraph) {
          splitNodes.push(trailingParagraph)
        }

        if (splitNodes.length > 0) {
          parent.children.splice(index, 1, ...splitNodes)
        }
        return
      }

      // Single image: convert to figure in non-gallery containers
      if (imgNodes.length === 1) {
        const figure = createFigure(imgNodes[0], false)
        if (figure !== imgNodes[0]) {
          // Only replace if conversion happened
          node.tagName = 'figure'
          node.properties = figure.properties
          node.children = figure.children
        }
        return
      }

      // Multiple images: unwrap in non-gallery containers
      parent.children.splice(index, 1, ...imgNodes)
    })
  }
}
