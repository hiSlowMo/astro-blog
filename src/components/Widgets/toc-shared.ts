import type { MarkdownHeading } from 'astro'

export interface TocSeriesItem {
  title: string
  href: string
  date: string
  isCurrent: boolean
}

export interface TocTreeNode {
  slug: string
  text: string
  depth: number
  children: TocTreeNode[]
}

export interface TocPanelProps {
  filteredHeadings: MarkdownHeading[]
  seriesItems: TocSeriesItem[]
  currentUI: {
    toc: string
    series: string
  }
  hasToc: boolean
  hasSeries: boolean
}

export function buildTocTree(headings: MarkdownHeading[]): TocTreeNode[] {
  const root: TocTreeNode[] = []
  const stack: TocTreeNode[] = []

  for (const heading of headings) {
    const node: TocTreeNode = {
      slug: heading.slug,
      text: heading.text,
      depth: heading.depth,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    }
    else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return root
}
