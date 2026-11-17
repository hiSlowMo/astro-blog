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

// Mirrors the article widths in reading.css (min(100% - 7rem, 44rem) from
// 768px up) and the generic Layout.astro container below that breakpoint.
const ARTICLE_CONTENT_WIDTH = 'min(calc(100vw - 7rem), 44rem)'
const TABLET_CONTENT_WIDTH = 'calc(min(100vw, 45rem) - 5rem)'
const PHONE_CONTENT_WIDTH = 'calc(100vw - 2.7rem)'
const NARROW_CONTENT_WIDTH = '88vw'

const CONTENT_IMAGE_SIZES = [
  `(min-width: 768px) ${ARTICLE_CONTENT_WIDTH}`,
  `(min-width: 640px) ${TABLET_CONTENT_WIDTH}`,
  `(min-width: 360px) ${PHONE_CONTENT_WIDTH}`,
  NARROW_CONTENT_WIDTH,
].join(', ')

// Gallery items cap at 80% of the content column, 70% on lg screens.
const GALLERY_IMAGE_SIZES = [
  '(min-width: 1024px) 493px',
  '(min-width: 768px) min(calc(80vw - 5.6rem), 35.2rem)',
  '(min-width: 640px) calc(min(80vw, 36rem) - 4rem)',
  '(min-width: 360px) calc(80vw - 2.16rem)',
  '70.4vw',
].join(', ')

function applyLoadingAttributes(imgNode) {
  const properties = imgNode.properties ?? (imgNode.properties = {})
  properties.loading ??= 'lazy'
  properties.decoding ??= 'async'
}

function applyContentImageSizes(imgNode, width) {
  const properties = imgNode.properties ?? (imgNode.properties = {})
  properties.sizes ??= getSizesForWidth(width)
}

function applyGalleryImageSizes(imgNode) {
  const properties = imgNode.properties ?? (imgNode.properties = {})
  properties.sizes ??= GALLERY_IMAGE_SIZES
}

function formatSize(value) {
  return Number(value.toFixed(3))
}

function getSizesForWidth(width) {
  if (!width) {
    return CONTENT_IMAGE_SIZES
  }

  const percentMatch = width.match(/^(\d+(?:\.\d+)?)%$/)
  if (!percentMatch) {
    return [
      `(min-width: 768px) min(${width}, ${ARTICLE_CONTENT_WIDTH})`,
      `(min-width: 640px) min(${width}, ${TABLET_CONTENT_WIDTH})`,
      `(min-width: 360px) min(${width}, ${PHONE_CONTENT_WIDTH})`,
      `min(${width}, ${NARROW_CONTENT_WIDTH})`,
    ].join(', ')
  }

  const ratio = Math.min(Number(percentMatch[1]) / 100, 1)
  const vw = value => `${formatSize(value)}vw`
  const rem = value => `${formatSize(value)}rem`

  return [
    `(min-width: 768px) min(calc(${vw(100 * ratio)} - ${rem(7 * ratio)}), ${rem(44 * ratio)})`,
    `(min-width: 640px) calc(min(${vw(100 * ratio)}, ${rem(45 * ratio)}) - ${rem(5 * ratio)})`,
    `(min-width: 360px) calc(${vw(100 * ratio)} - ${rem(2.7 * ratio)})`,
    vw(88 * ratio),
  ].join(', ')
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
  const { width } = parseImageOptions(imgNode)

  if (isInGallery) {
    applyGalleryImageSizes(imgNode)
  }
  else {
    applyContentImageSizes(imgNode, width)
  }

  const rawAltText = imgNode.properties?.alt
  const shouldSkipCaption = !rawAltText || rawAltText.startsWith('_')
  // A leading underscore marks alt text that should not become a visible caption.
  // Keep the text itself in the alt attribute for accessibility.
  const altText = shouldSkipCaption && typeof rawAltText === 'string'
    ? rawAltText.replace(/^_/, '')
    : rawAltText

  if (altText !== rawAltText) {
    imgNode.properties ??= {}
    imgNode.properties.alt = altText
  }

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

      for (const imgNode of imgNodes) {
        applyLoadingAttributes(imgNode)
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
